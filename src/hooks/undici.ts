import { safeRequire } from '../utils/requireUtils';
import { BaseHttp, HttpRequestTracingConfig, ParseHttpRequestOptions } from './baseHttp';

export interface UndiciRequest {
  origin: string;
  method: string;
  path: string;
  headers: string | string[];
  addHeader: (name: string, value: string) => void;
  throwOnError: boolean;
  completed: boolean;
  aborted: boolean;
  idempotent: boolean;
  contentLength: number | null;
  contentType: string | null;
  body: any;
}

export interface UndiciResponse {
  headers: Buffer[];
  statusCode: number;
}

export interface ListenerRecord {
  name: string;
  channel: any; // TODO: This is of type Channel, find where I can import it from
  onMessage: (message: any, name: string) => void;
}

export interface RequestMessage {
  request: UndiciRequest;
}

export interface RequestHeadersMessage {
  request: UndiciRequest;
  socket: any;
}

export interface ResponseHeadersMessage {
  request: UndiciRequest;
  response: UndiciResponse;
}

export interface RequestTrailersMessage {
  request: UndiciRequest;
  response: UndiciResponse;
}

export interface RequestErrorMessage {
  request: UndiciRequest;
  error: Error;
}

export class UndiciInstrumentation {
  private readonly diagch?: {
    channel: (name: string) => any;
  };
  private requestContext: WeakMap<UndiciRequest, HttpRequestTracingConfig>;

  constructor() {
    this.diagch = safeRequire('diagnostic-channel');
    this.requestContext = new WeakMap<UndiciRequest, HttpRequestTracingConfig>();
  }

  static startInstrumentation() {
    const undiciInstrumentation = new UndiciInstrumentation();
    if (undiciInstrumentation.libAvailable()) {
      undiciInstrumentation.hookUndici();
    }
  }

  private libAvailable(): boolean {
    return !!this.diagch;
  }

  private subscribeToChannel(diagnosticChannel: string, onMessage: ListenerRecord['onMessage']) {
    if (this.diagch) {
      const channel = this.diagch.channel(diagnosticChannel);
      channel.subscribe(onMessage);
    }
  }

  hookUndici(): void {
    // Request created, but no connection to remote server has been made yet
    this.subscribeToChannel('undici:request:create', this.onRequestCreated.bind(this));

    // Response metadata was received (headers, status code), and about to start loading response body
    this.subscribeToChannel('undici:request:headers', this.onResponseHeaders.bind(this));

    // The response was received in full, request is complete
    this.subscribeToChannel('undici:request:trailers', this.onDone.bind(this));

    // Request encountered an error (bad http status codes don't count here)
    this.subscribeToChannel('undici:request:error', this.onError.bind(this));
  }

  /**
   * Parsed headers as they are passed in the raw undici message to a key value object
   * Request headers in undici are passed in one of two formats:
   * 1. An array of strings, where keys are followed by values in the next index (e.g. ['key1', 'value1', 'key2', 'value2'])
   * 2. A string with headers separated by '\r\n' (e.g. 'key1: value1\r\nkey2: value2')
   * @param {string | string[]} headers
   * @returns {Record<string, string>}
   */
  static parseHeaders(headers: string | string[]): Record<string, string> {
    const parsedHeaders = {};
    if (Array.isArray(headers) && headers.length % 2 === 0) {
      for (let i = 0; i + 1 < headers.length; i += 2) {
        parsedHeaders[headers[i]] = headers[i + 1];
      }
    } else if (typeof headers === 'string') {
      headers.split('\r\n').forEach((header) => {
        const [key, value] = header.split(': ');
        parsedHeaders[key] = value;
      });
    }

    return parsedHeaders;
  }

  private static parseHttpRequestArguments({ request }: RequestMessage): {
    url: string;
    options: any;
  } {
    const rawUrl = request.origin + request.path;
    const url = new URL(rawUrl);
    const urlScheme = url.protocol.replace(':', '');
    const headers = UndiciInstrumentation.parseHeaders(request.headers);

    const options: ParseHttpRequestOptions = {
      headers,
      method: request.method,
      path: request.path,
      hostname: url.hostname,
      host: url.host,
      protocol: urlScheme,
      uri: {
        hostname: url.hostname,
      },
    };

    return { url: rawUrl, options };
  }

  static addRequestHeaders({
    request,
    addedHeaders,
  }: {
    request: UndiciRequest;
    addedHeaders: Record<string, string>;
  }): void {
    // TODO: Implement this
  }

  /**
   * This is the 1st message we receive for each request (fired after request creation). Here we will
   * create the span and populate some attributes, then link the span to the request for further
   * span processing
   * @param {RequestMessage} message
   */
  onRequestCreated({ request }: RequestMessage): void {
    if (!this.libAvailable()) {
      return;
    }

    const { url, options } = UndiciInstrumentation.parseHttpRequestArguments({ request });

    const requestTracingData = BaseHttp.onRequestCreated({
      options,
      url,
    });

    if (!requestTracingData) {
      return;
    }

    const { addedHeaders } = requestTracingData;

    if (addedHeaders) {
      UndiciInstrumentation.addRequestHeaders({ request, addedHeaders });
    }

    this.requestContext.set(request, requestTracingData);
  }

  onResponseHeaders({ request, response }: ResponseHeadersMessage): void {
    const requestContext = this.requestContext.get(request);
    if (!requestContext) {
      return;
    }

    const { httpSpan = undefined } = requestContext;
    if (!httpSpan) {
      return;
    }

    // TODO: Add the response headers & status code to the request context, + mark the request as erroneous if the status code is an error
  }

  /**
   * This is the last event we receive if the request went without any errors
   * @param {RequestTrailersMessage} message
   */
  onDone({ request }: RequestTrailersMessage): void {
    const requestContext = this.requestContext.get(request);
    if (!requestContext) {
      return;
    }

    const { httpSpan = undefined } = requestContext;
    if (!httpSpan) {
      return;
    }

    // TODO: The request is complete, call the BaseHttp.createResponseDataWriterHandler to create the final span
  }

  /**
   * This is the event we get when something is wrong in the request like
   * - invalid options when calling `fetch` global API or any undici method for request
   * - connectivity errors such as unreachable host
   * - requests aborted through an `AbortController.signal`
   * NOTE: server errors are considered valid responses, and it's the lib consumer
   *  who should deal with that.
   * @param {RequestErrorMessage} message
   */
  onError({ request }: RequestErrorMessage): void {
    const requestContext = this.requestContext.get(request);
    if (!requestContext) {
      return;
    }

    const { httpSpan = undefined } = requestContext;
    if (!httpSpan) {
      return;
    }

    // TODO: Mark the request as erroneous, and call the BaseHttp.createResponseDataWriterHandler to create the final span
    // TODO: Add an erroneous property to the request context that will be respected by the BaseHttp.createResponseDataWriterHandler func
  }
}
