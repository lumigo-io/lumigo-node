import { BaseHttp, ParseHttpRequestOptions, RequestData, UrlAndRequestOptions } from './baseHttp';
import * as logger from '../logger';
import { TextDecoder } from 'util';
import { getEventEntitySize, safeExecute, safeExecuteAsync } from '../utils';

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
    const originalFetch = fetch;

    // @ts-ignore
    fetch = async (...args: any[]): Promise<Response> => {
      const context: RequestExtenderContext = {};
      const safeBeforeFetch = safeExecute(
        FetchInstrumentation.beforeFetch,
        'Fetch instrumentation - before fetch function call',
        logger.LOG_LEVELS.WARNING,
        args
      );
      const modifiedArgs = safeBeforeFetch(args, context);

      try {
        // TODO: Switch to explicit args and not generic array
        // @ts-ignore
        const response = await originalFetch(...modifiedArgs);
        context.response = response;
        const safeCreateResponseSpan = safeExecuteAsync({
          callback: FetchInstrumentation.createResponseSpan,
          message: 'Fetch instrumentation - create response span',
          defaultReturn: response,
        });
        await safeCreateResponseSpan(context);
        return response;
      } catch (error) {
        const safeCreateResponseSpan = safeExecuteAsync({
          callback: FetchInstrumentation.createResponseSpan,
          message: 'Fetch instrumentation - create response span',
        });
        await safeCreateResponseSpan(context);
        throw error;
      }
    };
  }

  /**
   * Runs before the fetch command is executed
   */
  private static beforeFetch(args: any[], extenderContext: RequestExtenderContext): any[] {
    logger.debug('Fetch instrumentor - before fetch function call', {
      args,
      extenderContext,
    });
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

    let modifiedArgs = args;
    if (addedHeaders) {
      options.headers = headers;
      modifiedArgs = FetchInstrumentation.addHeadersToFetchArguments(args, options);
    }
    extenderContext.isTracedDisabled = false;

    return modifiedArgs;
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

    const bodyStream = clonedResponse.body;
    if (bodyStream) {
      const textDecoder = new TextDecoder();
      // @ts-ignore
      for await (const chunk: Uint8Array of bodyStream) {
        try {
          const chunkString = textDecoder.decode(chunk);
          const { truncated } = responseDataWriterHandler(['data', chunkString]);
          if (truncated) {
            // No need to consume the rest of the body if it reached the limit
            break;
          }
        } catch (e) {
          logger.debug(
            'Lumigo fetch instrumentation - failed decoding response body stream chunk, skipping it',
            e
          );
        }
      }
    }
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
   * Adds the headers found in the options object to the fetch arguments, and return the modified arguments.
   * The original arguments will not be modified.
   * @param {any[]} args Raw arguments that will be passed to the fetch function call
   * @param {ParseHttpRequestOptions} options The HTTP request options to get the headers from
   * @returns {any[]} The modified arguments with the headers added
   * @private
   */
  private static addHeadersToFetchArguments(args: any[], options: ParseHttpRequestOptions): any[] {
    const modifiedArgs = [...args];
    if (modifiedArgs.length === 1) {
      modifiedArgs.push({ headers: options.headers });
    }
    if (modifiedArgs.length === 2) {
      modifiedArgs[1] = { ...modifiedArgs[1], headers: options.headers };
    }
    return modifiedArgs;
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
