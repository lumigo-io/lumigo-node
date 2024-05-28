import { BaseHttp, ParseHttpRequestOptions, RequestData, UrlAndRequestOptions } from './baseHttp';
import * as logger from '../logger';
import { getEventEntitySize, safeExecuteAsync } from '../utils';

interface ResponseData {
  headers?: Record<string, string>;
  statusCode?: number;
  body?: string;
  // The time when all the response data was received, including all the body chunks
  receivedTime?: number;
  truncated?: boolean;
  isNetworkError?: boolean;
}

interface RequestExtenderContext {
  isTracedDisabled?: boolean;
  awsRequestId?: string;
  transactionId?: string;
  requestRandomId?: string;
  currentSpan?: any;
  requestData?: RequestData;
  response?: Response;
}

interface FetchArguments {
  input: RequestInfo | URL;
  init?: RequestInit;
}

type FetchUrlAndRequestOptions = UrlAndRequestOptions & {
  options: ParseHttpRequestOptions & {
    body?: string;
  };
};

export class FetchInstrumentation {
  /**
   * Starts the fetch instrumentation by attaching the hooks to the fetch function.
   * Note: safe to call even if the fetch instrumentation was already started / fetch is not available.
   */
  static startInstrumentation() {
    if (FetchInstrumentation.libAvailable()) {
      logger.debug('fetch available, attaching instrumentation hooks');
      FetchInstrumentation.attachHooks();
    } else {
      logger.debug('Fetch not available, skipping instrumentation');
    }
  }

  /**
   * Stops the fetch instrumentation by removing the hooks from the fetch function.
   * Note: safe to call even if the fetch instrumentation was not started / fetch is not available.
   */
  static stopInstrumentation() {
    if (!FetchInstrumentation.libAvailable()) {
      logger.debug('Fetch not available, can not stop instrumentation');
      return;
    }
    FetchInstrumentation.removeHooks();
  }

  /**
   * Checks if the fetch command is available in the current environment (Native to node from version 18 and above)
   * @returns {boolean} True if available, false otherwise
   * @private
   */
  private static libAvailable(): boolean {
    return typeof fetch === 'function';
  }

  /**
   * Attaches the instrumentation hooks to the fetch function.
   * If the hooks are already attached, this function will do nothing.
   * @private
   */
  private static attachHooks(): void {
    // @ts-ignore
    if (fetch.__originalFetch) {
      logger.debug('Fetch instrumentation hooks already attached');
      return;
    }

    const originalFetch = fetch;

    // @ts-ignore
    fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const extenderContext: RequestExtenderContext = {};
      const safeBeforeFetch = safeExecuteAsync({
        fn: FetchInstrumentation.beforeFetch,
        message: 'Fetch instrumentation - before fetch function call',
        logLevel: logger.LOG_LEVELS.WARNING,
        defaultReturn: {
          input,
          init,
        },
      });
      const modifiedArgs = await safeBeforeFetch({ input, init, extenderContext });

      try {
        // @ts-ignore
        const response = await originalFetch(modifiedArgs.input, modifiedArgs.init);
        extenderContext.response = response;
        const safeCreateResponseSpan = safeExecuteAsync({
          fn: FetchInstrumentation.createResponseSpan,
          message: 'Fetch instrumentation - create response span',
          defaultReturn: response,
        });
        await safeCreateResponseSpan(extenderContext);
        return response;
      } catch (error) {
        const safeCreateResponseSpan = safeExecuteAsync({
          fn: FetchInstrumentation.createResponseSpan,
          message: 'Fetch instrumentation - create response span',
        });
        await safeCreateResponseSpan(extenderContext);
        throw error;
      }
    };
    // @ts-ignore
    fetch.__originalFetch = originalFetch;
  }

  private static removeHooks(): void {
    // @ts-ignore
    if (fetch.__originalFetch) {
      // @ts-ignore
      fetch = fetch.__originalFetch;
    }
  }

  /**
   * Runs before the fetch command is executed
   * @param args
   * @param {RequestInfo | URL} args.input The first argument (called input / resource) that is passed to the fetch command
   * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
   * @param {RequestExtenderContext} args.extenderContext The extender context object that will be used to pass data between the instrumentation functions running before & after the fetch command
   * @returns {Promise<FetchArguments | undefined>} The modified fetch arguments with the headers added from the args.options object, or undefined if the request should not be traced
   */
  private static async beforeFetch({
    input,
    init,
    extenderContext,
  }: FetchArguments & {
    extenderContext: RequestExtenderContext;
  }): Promise<FetchArguments> {
    logger.debug('Fetch instrumentor - before fetch function call', {
      input,
      init,
      extenderContext,
    });
    const originalArgs: FetchArguments = { input, init };
    extenderContext.isTracedDisabled = true;
    const { url, options } = await FetchInstrumentation.parseRequestArguments(originalArgs);
    const requestTracingData = BaseHttp.onRequestCreated({
      options,
      url,
    });
    logger.debug('Fetch instrumentor - parsed request data', { requestTracingData });
    if (!requestTracingData) {
      return originalArgs;
    }
    const {
      addedHeaders,
      headers,
      requestRandomId,
      awsRequestId,
      transactionId,
      httpSpan = undefined,
      requestData = undefined,
    } = requestTracingData;

    BaseHttp.aggregateRequestBodyToSpan(
      options.body,
      requestData,
      httpSpan,
      getEventEntitySize(true)
    );

    extenderContext.awsRequestId = awsRequestId;
    extenderContext.transactionId = transactionId;
    extenderContext.requestRandomId = requestRandomId;
    if (requestData) {
      extenderContext.requestData = requestData;
    }
    if (httpSpan) {
      extenderContext.currentSpan = httpSpan;
    }

    let modifiedArgs: FetchArguments = { ...originalArgs };
    if (addedHeaders) {
      options.headers = headers;
      modifiedArgs = FetchInstrumentation.addHeadersToFetchArguments({ ...modifiedArgs, options });
    }
    extenderContext.isTracedDisabled = false;

    return modifiedArgs;
  }

  /**
   * Runs when the fetch response promise is resolved. This function will read the response body and record the data.
   * All the additional parameters are extracted from the extender context object.
   * @param {RequestExtenderContext} args
   * @param {string} args.transactionId The transaction id of the request
   * @param {string} args.awsRequestId The AWS request ID of the current lambda invocation
   * @param {RequestData} args.requestData The request data object
   * @param {string} args.requestRandomId The random ID of the request
   * @param {Response} args.response The response object returned by the fetch promise
   * @private
   */
  private static async createResponseSpan({
    transactionId,
    awsRequestId,
    requestData,
    requestRandomId,
    response,
  }: RequestExtenderContext): Promise<void> {
    if (!response) {
      return;
    }

    const clonedResponse = response.clone();
    const responseData = FetchInstrumentation.convertResponseToResponseData(clonedResponse);
    const responseDataWriterHandler = BaseHttp.createResponseDataWriterHandler({
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId,
      response: responseData,
    });

    const bodyText = await clonedResponse.text();
    responseDataWriterHandler(['data', bodyText]);
    responseDataWriterHandler(['end']);
  }

  /**
   * Parses the raw arguments passed to the fetch function and returns the URL and options object.
   * @param {FetchArguments} args The raw fetch arguments
   * @param {RequestInfo | URL} args.input The first argument (called input / resource) that is passed to the fetch command
   * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
   * @returns {UrlAndRequestOptions} Our custom request options object containing the URL and options
   * @private
   */
  private static async parseRequestArguments({
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
    } else if (input instanceof Request) {
      url = input.url;
      options.method = input.method || 'GET';
      options.headers = FetchInstrumentation.convertHeadersToKeyValuePairs(input.headers);
    }

    if (init) {
      options.method = init.method || options.method || 'GET';
      options.headers = {
        ...options.headers,
        ...FetchInstrumentation.convertHeadersToKeyValuePairs(init.headers),
      };
    }

    // Read the body from the request object, only if we shouldn't look in the init object
    let body: string = undefined;
    try {
      if (input instanceof Request && input.body && !init?.body) {
        body = await input.clone().text();
      }
    } catch (e) {
      logger.debug('Failed to read body from Request object', e);
    }

    // If we didn't get the body from the request object, get it from the init object
    if (!body && init?.body) {
      try {
        const decoder = new TextDecoder();
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
   * @private
   */
  private static convertHeadersToKeyValuePairs(
    headers: [string, string][] | Record<string, string> | Headers
  ): Record<string, string> {
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
  private static addHeadersToFetchArguments({
    input,
    init,
    options,
  }: FetchArguments & { options: ParseHttpRequestOptions }): FetchArguments {
    // The init headers take precedence over the input headers
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
   * @private
   */
  private static convertResponseToResponseData(response: Response): ResponseData {
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
