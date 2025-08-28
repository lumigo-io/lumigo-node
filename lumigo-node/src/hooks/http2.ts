import { URL } from 'url';
import * as extender from '../extender';
import * as http2 from 'http2';

import { GlobalDurationTimer } from '../utils/globalDurationTimer';
import { BaseHttp, RequestData } from './baseHttp';
import { BasicChildSpan } from '../types/spans/basicSpan';
import * as logger from '../logger';

// HTTP/2 specific headers that should be removed from the options.headers object
const HTTP2_HEADERS = [
  http2.constants.HTTP2_HEADER_METHOD,
  http2.constants.HTTP2_HEADER_PATH,
  http2.constants.HTTP2_HEADER_SCHEME,
  http2.constants.HTTP2_HEADER_AUTHORITY,
  http2.constants.HTTP2_HEADER_STATUS,
];

export class Http2 {
  @GlobalDurationTimer.timedSync()
  static http2RequestArguments(args: any[]): { url?: string; options?: any; callback?: Function } {
    // Log the args array with more details about types
    logger.debug('HTTP/2 request arguments', {
      args,
      argsLength: args.length,
    });

    if (args.length === 0) {
      logger.debug('HTTP/2 request arguments error: no arguments provided');
      throw new Error('ClientHttp2Session.request(...) was called without any arguments.');
    }

    let url = undefined;
    let options = undefined;
    let callback = undefined;

    // Handle HTTP/2 specific headers format - this is the primary format for HTTP/2 requests
    if (
      args[0] &&
      typeof args[0] === 'object' &&
      !Array.isArray(args[0]) &&
      !(args[0] instanceof URL) &&
      args[0][':method'] &&
      args[0][':path']
    ) {
      const headers = args[0];
      const method = headers[':method'];
      const path = headers[':path'];
      const scheme = headers[':scheme'] || 'https'; // Default to https if not provided
      const authority = headers[':authority'] || ''; // Authority might be empty

      // Construct URL from HTTP/2 headers
      url = `${scheme}://${authority}${path}`;

      // Create options object with appropriate structure
      options = {
        method,
        headers: { ...headers }, // Copy all headers
        path,
        protocol: `${scheme}:`,
        hostname: authority,
        host: authority,
      };

      // Store HTTP/2 specific headers in a separate property for reference
      options.http2Headers = {
        method,
        path,
        scheme,
        authority,
      };

      // Remove HTTP/2 specific headers from the headers object
      for (const header of HTTP2_HEADERS) {
        delete options.headers[header];
      }

      // Check for callback in the second argument
      if (typeof args[1] === 'function') {
        callback = args[1];
      }

      logger.debug('HTTP/2 request arguments parsed from headers', {
        url,
        method,
        path,
        authority,
        scheme,
        hasCallback: !!callback,
      });

      return { url, options, callback };
    }

    logger.debug('HTTP/2 request arguments: final result', {
      url: url,
      optionsKeys: options ? Object.keys(options) : [],
    });

    return { url, options, callback };
  }

  @GlobalDurationTimer.timedSync()
  static http2AfterConnectWrapper(args, originalFnResult) {
    logger.debug('HTTP/2 after connect wrapper called', {
      args,
      argsLength: args.length,
    });
    // Hook the request method to capture HTTP/2 requests
    // ClientHttp2Session.request creates a new HTTP/2 stream for sending a request and receiving a response
    // This is the correct hook point as it's called for every HTTP/2 request made through this session
    extender.hook(originalFnResult, 'request', {
      beforeHook: (args, extenderContext) => {
        const { url, options = {} } = Http2.http2RequestArguments(args);

        logger.debug('HTTP/2 before request wrapper', { url, options });
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

        logger.debug('HTTP/2 before request extenderContext', {
          extenderContext,
          hasRequestData: !!extenderContext.requestData,
          hasCurrentSpan: !!extenderContext.currentSpan,
          hasRequestRandomId: !!extenderContext.requestRandomId,
          hasAwsRequestId: !!extenderContext.awsRequestId,
          hasTransactionId: !!extenderContext.transactionId,
        });
      },
      afterHook: (args, stream, extenderContext) => {
        // beforeHookData is the extenderContext object that was populated by the beforeHook
        // It contains requestData, requestRandomId, currentSpan, and other data set in the beforeHook

        logger.debug('HTTP/2 stream afterHook args', {
          args,
          argsLength: args.length,
          argsTypes: args.map((arg) => typeof arg),
        });

        // Log beforeHookData
        logger.debug('HTTP/2 stream afterHook beforeHookData', {
          beforeHookData: extenderContext,
          hasBeforeHookData: !!extenderContext,
        });
        if (!extenderContext) {
          logger.debug('HTTP/2 stream afterHook - no beforeHookData');
          return;
        }

        const { requestData, requestRandomId, awsRequestId, transactionId, currentSpan } =
          extenderContext;
        logger.debug('HTTP/2 stream afterHook', {
          hasRequestData: !!requestData,
          requestRandomId,
          hasCurrentSpan: !!currentSpan,
          hasStream: !!stream,
        });

        // Hook stream events to capture request and response data
        const endWrapper = BaseHttp.createRequestDataWriteHandler({ requestData, currentSpan });
        const writeWrapper = BaseHttp.createRequestDataWriteHandler({ requestData, currentSpan });

        // Hook response events
        const emitWrapper = Http2.http2StreamEmitBeforeHookWrapper(
          transactionId,
          awsRequestId,
          requestData,
          requestRandomId,
          currentSpan
        );

        // Hook the stream.end method which is called when the request is finished sending data
        // This allows us to capture the request body when it's sent to the server
        extender.hook(stream, 'end', { beforeHook: endWrapper });
        extender.hook(stream, 'write', { beforeHook: writeWrapper });

        // Hook the stream.emit method which is called for all events on the HTTP/2 stream
        // This allows us to capture response headers, data, and other events from the server
        extender.hook(stream, 'emit', { beforeHook: emitWrapper });
      },
    });
  }

  static http2StreamEmitBeforeHookWrapper(
    transactionId: string,
    awsRequestId: string,
    requestData: RequestData,
    requestRandomId: string,
    currentSpan: BasicChildSpan
  ) {
    let responseDataWriterHandler = undefined;

    logger.debug('HTTP/2 creating stream emit hook wrapper', {
      transactionId,
      awsRequestId,
      requestRandomId,
      hasRequestData: !!requestData,
      hasCurrentSpan: !!currentSpan,
    });

    // Ensure requestData has a body property
    if (!requestData) {
      requestData = { body: '' };
      logger.debug('HTTP/2 requestData was not defined, created empty');
    } else if (requestData.body === undefined) {
      requestData.body = '';
      logger.debug('HTTP/2 requestData.body was undefined, set to empty string');
    }

    return function (args: any[]) {
      GlobalDurationTimer.start();
      logger.debug('HTTP/2 stream emit event', { eventType: args[0] });

      if (args[0] === 'response') {
        const responseObj = args[1];

        // Format the HTTP/2 response to match the expected structure for BaseHttp.createResponseDataWriterHandler
        const formattedResponse = {
          headers: { ...responseObj }, // Copy all headers from response
          statusCode: responseObj[':status'] || 0, // Extract status code from :status header
        };

        logger.debug('HTTP/2 response event received', {
          hasResponseObj: !!responseObj,
          statusCode: formattedResponse.statusCode,
          hasHeaders: !!formattedResponse.headers,
          headerKeys: formattedResponse.headers ? Object.keys(formattedResponse.headers) : [],
          responseObj: responseObj,
        });

        responseDataWriterHandler = BaseHttp.createResponseDataWriterHandler({
          transactionId,
          awsRequestId,
          requestData,
          requestRandomId,
          response: formattedResponse,
        });
      }

      if (args[0] === 'data') {
        const data = args[1];
        // For HTTP/2, data event contains the response body data

        if (responseDataWriterHandler) {
          logger.debug('HTTP/2 data event - calling responseDataWriterHandler');
          responseDataWriterHandler(args);
        }
      }

      if (args[0] === 'end') {
        logger.debug('HTTP/2 end event received');

        if (responseDataWriterHandler) {
          logger.debug('HTTP/2 end event - calling responseDataWriterHandler');
          responseDataWriterHandler(args);
        }
      }

      if (args[0] === 'error') {
        const errorObj = args[1];
        logger.warn('HTTP/2 error event received', {
          error: errorObj ? errorObj.message : 'Unknown error',
          errorObject: errorObj,
          errorType: errorObj ? typeof errorObj : 'undefined',
          errorStack: errorObj && errorObj.stack ? errorObj.stack : undefined,
        });
      }
      GlobalDurationTimer.stop();
    };
  }

  static wrapHttp2Lib(http2Lib) {
    // Hook the connect method which creates a new HTTP/2 session
    logger.info('HTTP/2 hooking connect method');
    extender.hook(http2Lib, 'connect', {
      afterHook: Http2.http2AfterConnectWrapper,
    });
  }

  static hookHttp2() {
    Http2.wrapHttp2Lib(http2);
    logger.info('HTTP/2 hooks initialized');
  }
}
