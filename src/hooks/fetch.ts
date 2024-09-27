import { BaseHttp, ParseHttpRequestOptions, RequestData, UrlAndRequestOptions } from './baseHttp';
import * as logger from '../logger';
import { getEventEntitySize, safeExecuteAsync } from '../utils';
import { BaseFetch, FetchArguments, RequestExtenderContext } from './baseFetch';

export class FetchInstrumentation extends BaseFetch {
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
    // @ts-ignore
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

    // @ts-ignore
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
    const { url, options } = await FetchInstrumentation._parseRequestArguments(originalArgs);
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
      modifiedArgs = FetchInstrumentation._addHeadersToFetchArguments({ ...modifiedArgs, options });
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
    const responseData = FetchInstrumentation._convertResponseToResponseData(clonedResponse);
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
}
