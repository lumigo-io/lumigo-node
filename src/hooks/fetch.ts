import { BaseHttp, ParseHttpRequestOptions, RequestData } from './baseHttp';
import * as logger from '../logger';
import { hookFunc, hookPromiseAsyncHandlers } from '../extender';
import { TextDecoder } from 'util';

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
  isTracedDisabled: boolean;
  awsRequestId: string;
  transactionId: string;
  requestRandomId: string;
  currentSpan: any;
  requestData: RequestData;
}

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
      afterHook: FetchInstrumentation.afterFetch,
    });
  }

  private static parseRequestArguments(args: any[]): {
    url: string;
    options: ParseHttpRequestOptions;
  } {
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

  private static addHeadersToFetchArguments(args: any[], options: ParseHttpRequestOptions): void {
    if (args.length === 1) {
      args.push({ headers: options.headers });
    }
    if (args.length === 2) {
      Object.assign(args[1], { headers: options.headers });
    }
  }

  private static beforeFetch(args: any[], extenderContext: RequestExtenderContext): void {
    logger.debug('beforeFetch', { args, extenderContext });
    extenderContext.isTracedDisabled = true;
    const { url, options = {} } = FetchInstrumentation.parseRequestArguments(args);
    const requestTracingData = BaseHttp.onRequestCreated({
      options,
      url,
    });
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

  private static afterFetch(
    args: any[],
    originalFnResult: Promise<any>,
    extenderContext: RequestExtenderContext
  ): void {
    logger.debug('afterFetch', { args, originalFnResult, extenderContext });
    if (extenderContext.isTracedDisabled) {
      return;
    }
    if (!(originalFnResult instanceof Promise)) {
      logger.debug('Fetch instrumentation after fetch: original function result is not a promise');
      return;
    }

    const { transactionId, awsRequestId, requestData, requestRandomId } = extenderContext;

    hookPromiseAsyncHandlers(originalFnResult, {
      thenHandler: async (response: Response) => {
        return FetchInstrumentation.fetchResponseThenHandler({
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

  private static async fetchResponseThenHandler({
    transactionId,
    awsRequestId,
    requestData,
    requestRandomId,
    response,
  }: {
    transactionId: string;
    awsRequestId: string;
    requestData: RequestData;
    requestRandomId: string;
    response: Response;
  }): Promise<void> {
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
          const chunkString = new TextDecoder().decode(chunk);
          const { truncated } = responseDataWriterHandler(['data', chunkString]);
          if (truncated) {
            // No need to consume the rest of the body if it reached the limit
            break;
          }
        } catch (e) {
          logger.debug('Error decoding response body stream chunk', e);
        }
      }
    }

    logger.debug('Fetch instrumentation - response end');
    responseDataWriterHandler(['end']);
  }
}
