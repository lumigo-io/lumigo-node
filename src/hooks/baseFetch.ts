import { ParseHttpRequestOptions, RequestData, UrlAndRequestOptions } from './baseHttp';
import * as logger from '../logger';

export interface ResponseData {
  headers?: Record<string, string>;
  statusCode?: number;
  body?: string;
  // The time when all the response data was received, including all the body chunks
  receivedTime?: number;
  truncated?: boolean;
  isNetworkError?: boolean;
}

export interface RequestExtenderContext {
  isTracedDisabled?: boolean;
  awsRequestId?: string;
  transactionId?: string;
  requestRandomId?: string;
  currentSpan?: any;
  requestData?: RequestData;
  // @ts-ignore
  response?: Response;
}

export interface FetchArguments {
  // @ts-ignore
  input: RequestInfo | URL;
  // @ts-ignore
  init?: RequestInit;
}

export type FetchUrlAndRequestOptions = UrlAndRequestOptions & {
  options: ParseHttpRequestOptions & {
    body?: string;
  };
};

export class BaseFetch {
  constructor() {
    if (new.target === BaseFetch) {
      throw new Error('Cannot instantiate class.');
    }
  }

  /**
   * Parses the raw arguments passed to the fetch function and returns the URL and options object.
   * @param {FetchArguments} args The raw fetch arguments
   * @param {RequestInfo | URL} args.input The first argument (called input / resource) that is passed to the fetch command
   * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
   * @returns {UrlAndRequestOptions} Our custom request options object containing the URL and options
   * @protected
   */
  static async _parseRequestArguments({
    input,
    init,
  }: FetchArguments): Promise<FetchUrlAndRequestOptions> {
    let url: string = undefined;
    const options: ParseHttpRequestOptions & {
      body?: string;
    } = {
      headers: {},
      method: 'GET',
    };

    if (input instanceof URL) {
      url = input.toString();
    } else if (typeof input === 'string') {
      url = input;
      // @ts-ignore
    } else if (input instanceof Request) {
      url = input.url;
      options.method = input.method || 'GET';
      options.headers = BaseFetch._convertHeadersToKeyValuePairs(input.headers);
    }

    if (init) {
      options.method = init.method || options.method || 'GET';
      options.headers = {
        ...options.headers,
        ...BaseFetch._convertHeadersToKeyValuePairs(init.headers),
      };
    }

    // Read the body from the request object, only if we shouldn't look in the init object
    let body: string = undefined;
    try {
      // @ts-ignore
      if (input instanceof Request && input.body && !init?.body) {
        body = await input.clone().text();
      }
    } catch (e) {
      logger.debug('Failed to read body from Request object', e);
    }

    // If we didn't get the body from the request object, get it from the init object
    if (!body && init?.body) {
      try {
        // @ts-ignore
        const decoder = new TextDecoder();
        // @ts-ignore
        if (init.body instanceof ReadableStream) {
          const reader = init.body.getReader();
          let result = '';
          // Limiting the number of reads to prevent an infinite read loop
          for (let i = 0; i < 10000; i++) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            result += decoder.decode(value);
          }
          body = result;
          // @ts-ignore
        } else if (init.body instanceof Blob) {
          body = await init.body.text();
        } else if (init.body instanceof ArrayBuffer) {
          body = decoder.decode(init.body);
        } else if (typeof init.body === 'string') {
          body = init.body;
        } else {
          // TODO: Implement FormData support
          logger.debug('Unsupported request body type', typeof init.body);
        }
      } catch (e) {
        logger.debug('Failed to read request body from Request object', {
          error: e,
          bodyObjectType: typeof init.body,
        });
      }
    }

    if (body) {
      options.body = body;
    }

    return { url, options };
  }

  /**
   * Converts the headers object to a key-value pair object.
   * Fetch library uses multiple format to represent headers, this function will convert them all to a key-value pair object.
   * @param {[string, string][] | Record<string, string> | Headers} headers Headers object as used by the fetch library
   * @returns {Record<string, string>} The headers as a key-value pair object
   * @protected
   */
  static _convertHeadersToKeyValuePairs(
    // @ts-ignore
    headers: [string, string][] | Record<string, string> | Headers
  ): Record<string, string> {
    // @ts-ignore
    if (headers instanceof Headers) {
      const headersObject: Record<string, string> = {};
      headers.forEach((value, key) => {
        headersObject[key] = value;
      });
      return headersObject;
    }
    if (Array.isArray(headers)) {
      const headersObject: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        headersObject[key] = value;
      });
      return headersObject;
    }

    return headers;
  }

  /**
   * Adds the headers found in the options object to the fetch arguments, and return the modified arguments.
   * The original arguments will not be modified.
   * @param {FetchArguments} args The original fetch arguments
   * @param {ParseHttpRequestOptions} args.input The first argument (called input / resource) that is passed to the fetch command
   * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
   * @param {ParseHttpRequestOptions} args.options Our custom request options object containing the headers to add to the fetch arguments
   * @returns {FetchArguments} The modified fetch arguments with the headers added from the args.options object
   */
  static _addHeadersToFetchArguments({
    input,
    init,
    options,
  }: FetchArguments & { options: ParseHttpRequestOptions }): FetchArguments {
    // The init headers take precedence over the input headers
    // @ts-ignore
    const newInit: RequestInit = init ? { ...init } : {};

    if (options.headers) {
      const currentHeaders = newInit.headers || {};
      newInit.headers = { ...currentHeaders, ...options.headers };
    }

    return { input, init: newInit };
  }

  /**
   * Converts the fetch response object instance to a custom response data object used by the rest of the lumigo tracer codebase.
   * @param {Response} response
   * @returns {ResponseData}
   * @protected
   */
  // @ts-ignore
  static _convertResponseToResponseData(response: Response): ResponseData {
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      headers,
      statusCode: response.status,
    };
  }
}
