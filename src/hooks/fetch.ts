import { BaseHttp, ParseHttpRequestOptions, RequestData, UrlAndRequestOptions } from './baseHttp';
import * as logger from '../logger';
import { hookFunc, hookPromiseAsyncHandlers } from '../extender';
import { TextDecoder } from 'util';
import { getEventEntitySize } from '../utils';

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
  awsRequestId: string;
  transactionId: string;
  requestRandomId: string;
  currentSpan?: any;
  requestData?: RequestData;
  response?: Response;
}

type FetchUrlAndRequestOptions = UrlAndRequestOptions & {
  options: ParseHttpRequestOptions & {
    body?: string;
  };
};

export class FetchInstrumentation {
  static startInstrumentation() {
    if (FetchInstrumentation.libAvailable()) {
      logger.debug('fetch available, attaching instrumentation hooks');
      FetchInstrumentation.attachHooks();
    } else {
      logger.debug('Fetch not available, skipping instrumentation');
    }
  }

  private static libAvailable(): boolean {
    return typeof fetch === 'function';
  }

  private static attachHooks(): void {
    // @ts-ignore
    fetch = hookFunc(fetch, {
      beforeHook: FetchInstrumentation.beforeFetch,
      afterHook: FetchInstrumentation.onFetchPromiseReturned,
    });
  }

  /**
   * Runs before the fetch command is executed
   * @param {any[]} args The arguments passed to the fetch function
   * @param {RequestExtenderContext} extenderContext A blank object that will be passed to the next hooks for fetch
   * @private
   */
  private static beforeFetch(args: any[], extenderContext: RequestExtenderContext): void {
    logger.debug('Fetch instrumentor - before fetch function call', { args, extenderContext });
    extenderContext.isTracedDisabled = true;
    const { url, options } = FetchInstrumentation.parseRequestArguments(args);
    const requestTracingData = BaseHttp.onRequestCreated({
      options,
      url,
    });
    logger.debug('Fetch instrumentor - parsed request data', { requestTracingData });
    if (!requestTracingData) {
      return;
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

    if (addedHeaders) {
      options.headers = headers;
      FetchInstrumentation.addHeadersToFetchArguments(args, options);
    }
    extenderContext.isTracedDisabled = false;
  }

  /**
   * Runs after the fetch promise is created but before it is returned to the user.
   * Here we alter the promise to resolve to our own function that will record the response data.
   * @param {any[]} args The arguments passed to the fetch function call
   * @param {Promise<any>} originalFnResult The original promise returned by the fetch function
   * @param {RequestExtenderContext} extenderContext The context object passed to the next hooks for fetch
   * @private
   */
  private static onFetchPromiseReturned(
    args: any[],
    originalFnResult: Promise<any>,
    extenderContext: RequestExtenderContext
  ): void {
    logger.debug('onFetchPromiseReturned', { args, originalFnResult, extenderContext });
    if (extenderContext.isTracedDisabled) {
      return;
    }
    if (!(originalFnResult instanceof Promise)) {
      logger.debug('Fetch instrumentation after fetch: original function result is not a promise');
      return;
    }

    const { transactionId, awsRequestId, requestData, requestRandomId } = extenderContext;

    return hookPromiseAsyncHandlers(originalFnResult, {
      thenHandler: async (response: Response) => {
        return FetchInstrumentation.onFetchPromiseResolved({
          transactionId,
          awsRequestId,
          requestData,
          requestRandomId,
          response,
        });
      },
      catchHandler: async (args: any) => {
        // TODO: Figure out what to do here
        logger.debug(`afterFetch promise catch (args: ${args})`);
      },
    });
  }

  /**
   * Runs when the fetch response promise is resolved. This function will read the response body and record the data.
   * All the additional parameters are extracted from the extender context object.
   * @param {string} transactionId The transaction id of the request
   * @param {string} awsRequestId The AWS request ID of the current lambda invocation
   * @param {RequestData} requestData The request data object
   * @param {string} requestRandomId The random ID of the request
   * @param {Response} response The response object returned by the fetch promise
   * @private
   */
  private static async onFetchPromiseResolved({
    transactionId,
    awsRequestId,
    requestData,
    requestRandomId,
    response,
  }: RequestExtenderContext): Promise<void> {
    if (!response) {
      logger.debug(`Fetch instrumentation response handler - no response: ${response}`);
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
    const bodyStream = clonedResponse.body;
    if (bodyStream) {
      logger.debug('Fetch instrumentation - body found in response');
      // @ts-ignore
      for await (const chunk: Uint8Array of bodyStream) {
        try {
          // TODO: reuse the decoder object
          const chunkString = new TextDecoder().decode(chunk);
          const { truncated } = responseDataWriterHandler(['data', chunkString]);
          if (truncated) {
            // No need to consume the rest of the body if it reached the limit
            break;
          }
        } catch (e) {
          // TODO: Do not log if content isn't text (binary for example)
          logger.debug('Error decoding response body stream chunk', e);
        }
      }
    }

    logger.debug('Fetch instrumentation - response end');
    responseDataWriterHandler(['end']);
  }

  /**
   * Parses the raw arguments passed to the fetch function and returns the URL and options object.
   * @param {any[]} args
   * @returns {UrlAndRequestOptions}
   * @private
   */
  private static parseRequestArguments(args: any[]): FetchUrlAndRequestOptions {
    let url = undefined;
    if (args.length >= 1) {
      url = args[0];
    }
    const options = args.length >= 2 ? args[1] : {};

    if (!options.method) {
      options.method = 'GET';
    }

    return { url, options };
  }

  /**
   * Adds the headers found in the options object to the fetch arguments. The fetch arguments are modified in place.
   * @param {any[]} args Raw arguments that will be passed to the fetch function call
   * @param {ParseHttpRequestOptions} options
   * @private
   */
  private static addHeadersToFetchArguments(args: any[], options: ParseHttpRequestOptions): void {
    if (args.length === 1) {
      args.push({ headers: options.headers });
    }
    if (args.length === 2) {
      Object.assign(args[1], { headers: options.headers });
    }
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
