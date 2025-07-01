import { getCurrentTransactionId, getHttpSpan } from '../spans/awsSpan';
import { URL } from 'url';
import { SpansContainer, TracerGlobals } from '../globals';

import * as extender from '../extender';
import * as http2 from 'http2';

import { GlobalDurationTimer } from '../utils/globalDurationTimer';
import { runOneTimeWrapper } from '../utils/functionUtils';
import { BaseHttp, RequestData } from './baseHttp';
import { BasicChildSpan } from '../types/spans/basicSpan';
import * as logger from '../logger';

export class Http2 {
  @GlobalDurationTimer.timedSync()
  static http2RequestArguments(args: any[]): { url?: string; options?: any; callback?: Function } {
    // Log the args array with more details about types
    logger.debug('HTTP/2 request arguments', {
      args,
      argsLength: args.length,
      firstArgType: args.length > 0 ? typeof args[0] : 'none',
      firstArgIsArray: args.length > 0 ? Array.isArray(args[0]) : false,
      firstArgIsURL: args.length > 0 ? args[0] instanceof URL : false,
      secondArgType: args.length > 1 ? typeof args[1] : 'none',
      thirdArgType: args.length > 2 ? typeof args[2] : 'none',
    });

    if (args.length === 0) {
      logger.debug('HTTP/2 request arguments error: no arguments provided');
      throw new Error('http2.connect(...) was called without any arguments.');
    }

    let url = undefined;
    let options = undefined;
    let callback = undefined;

    // Handle HTTP/2 specific headers format
    if (
      args[0] &&
      typeof args[0] === 'object' &&
      !Array.isArray(args[0]) &&
      !(args[0] instanceof URL)
    ) {
      const headers = args[0];
      logger.debug('HTTP/2 request arguments: first arg is object', {
        hasMethodHeader: !!headers[':method'],
        hasPathHeader: !!headers[':path'],
        hasSchemeHeader: !!headers[':scheme'],
        hasAuthorityHeader: !!headers[':authority'],
        headerKeys: Object.keys(headers),
        isHttp2Headers: !!(
          headers[':method'] &&
          headers[':path'] &&
          (headers[':scheme'] || headers[':authority'])
        ),
      });

      // Check if this is an HTTP/2 headers object with special keys
      if (headers[':method'] && headers[':path'] && (headers[':scheme'] || headers[':authority'])) {
        const method = headers[':method'];
        const path = headers[':path'];
        const scheme = headers[':scheme'] || 'https';
        const authority = headers[':authority'] || '';

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

        logger.debug('HTTP/2 request arguments: created options from headers', {
          method,
          path,
          protocol: `${scheme}:`,
          hostname: authority,
          headerCount: Object.keys(headers).length,
          originalHeaders: headers,
        });

        // Remove HTTP/2 specific headers from the headers object
        delete options.headers[':method'];
        delete options.headers[':path'];
        delete options.headers[':scheme'];
        delete options.headers[':authority'];

        logger.debug('HTTP/2 request arguments: cleaned headers', {
          remainingHeaderCount: Object.keys(options.headers).length,
          remainingHeaders: options.headers,
        });

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

        return { url, options };
      }
    }

    // Handle standard URL and options format
    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      url = args[0];
      logger.debug('HTTP/2 request arguments: first arg is URL', {
        url: typeof url === 'string' ? url : url instanceof URL ? url.toString() : 'URL object',
        urlType: typeof url,
        isURLObject: url instanceof URL,
        hasSecondArg: args[1] !== undefined,
      });

      if (args[1]) {
        if (typeof args[1] === 'function') {
          callback = args[1];
          logger.debug('HTTP/2 request arguments: second arg is callback function', {
            callbackName: callback.name || 'anonymous',
            callbackLength: callback.length, // Number of parameters
          });
        } else {
          options = args[1];
          logger.debug('HTTP/2 request arguments: second arg is options object', {
            optionsKeys: options ? Object.keys(options) : [],
            hasHeaders: options && !!options.headers,
            headerKeys: options && options.headers ? Object.keys(options.headers) : [],
          });

          if (typeof args[2] === 'function') {
            callback = args[2];
            logger.debug('HTTP/2 request arguments: third arg is callback function', {
              callbackName: callback.name || 'anonymous',
              callbackLength: callback.length,
            });
          }
        }
      }
    } else {
      options = args[0];
      logger.debug('HTTP/2 request arguments: first arg is options object', {
        optionsKeys: options ? Object.keys(options) : [],
        hasHeaders: options && !!options.headers,
        headerKeys: options && options.headers ? Object.keys(options.headers) : [],
      });

      if (typeof args[1] === 'function') {
        callback = args[1];
        logger.debug('HTTP/2 request arguments: second arg is callback function', {
          callbackName: callback.name || 'anonymous',
          callbackLength: callback.length,
        });
      }
    }

    logger.debug('HTTP/2 request arguments: final result', {
      hasUrl: !!url,
      url: url,
      hasOptions: !!options,
      optionsKeys: options ? Object.keys(options) : [],
      hasCallback: !!callback,
    });

    return { url, options };
  }



  @GlobalDurationTimer.timedSync()
  static http2AfterConnectWrapper(args, originalFnResult, extenderContext) {
    const clientHttp2Session = originalFnResult;
    const {
      requestData,
      requestRandomId,
      isTracedDisabled,
      awsRequestId,
      transactionId,
      currentSpan,
    } = extenderContext;
    logger.debug('HTTP/2 after connect wrapper', {
      requestRandomId,
      awsRequestId,
      transactionId,
      hasRequestData: !!requestData,
      hasCurrentSpan: !!currentSpan,
    });
    if (isTracedDisabled) {
      return;
    }

    // Hook the request method to capture HTTP/2 requests
    extender.hook(clientHttp2Session, 'request', {
      beforeHook: (args) => {
        extenderContext.isTracedDisabled = true;
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

        extenderContext.isTracedDisabled = false;

      },
      afterHook: (args, stream, beforeHookData) => {
        logger.debug('HTTP/2 stream afterHook args', {
          args,
          argsLength: args.length,
          argsTypes: args.map((arg) => typeof arg),
        });

        // Log beforeHookData
        logger.debug('HTTP/2 stream afterHook beforeHookData', {
          beforeHookData,
          hasBeforeHookData: !!beforeHookData,
        });
        if (!beforeHookData) {
          logger.debug('HTTP/2 stream afterHook - no beforeHookData');
          return;
        }

        const { requestData, requestRandomId, currentSpan } = beforeHookData;
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

        extender.hook(stream, 'end', { beforeHook: endWrapper });
        extender.hook(stream, 'write', { beforeHook: writeWrapper });
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
    const emitResponseHandler = Http2.createEmitResponseHandler(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId
    );
    const oneTimerEmitResponseHandler = runOneTimeWrapper(emitResponseHandler, {});
    const socketWriteRequestHandler = BaseHttp.createRequestSocketDataWriteHandler({
      requestData,
      currentSpan,
    });
    return function (args: any[]) {
      GlobalDurationTimer.start();
      logger.debug('HTTP/2 stream emit event', { eventType: args[0] });

      if (args[0] === 'response') {
        const responseObj = args[1];
        logger.debug('HTTP/2 response event received', {
          hasResponseObj: !!responseObj,
          statusCode: responseObj?.statusCode,
          hasHeaders: responseObj?.headers ? true : false,
          headerKeys: responseObj?.headers ? Object.keys(responseObj.headers) : undefined,
        });
        oneTimerEmitResponseHandler(responseObj);
      }
      if (args[0] === 'headers') {
        // For HTTP/2, headers event contains the response headers
        const headers = args[1];
        const statusCode = headers[':status'];
        logger.debug('HTTP/2 headers event received', { headers, statusCode });
        oneTimerEmitResponseHandler({ headers, statusCode });
      }
      if (args[0] === 'socket') {
        logger.debug('HTTP/2 socket event received');
        socketWriteRequestHandler(args[1]);
      }
      if (args[0] === 'data') {
        logger.debug('HTTP/2 data event received', {
          dataLength: args[1] ? args[1].length : 0,
          dataType: args[1] ? typeof args[1] : 'undefined',
        });
      }
      if (args[0] === 'end') {
        logger.debug('HTTP/2 end event received');
      }
      if (args[0] === 'error') {
        logger.debug('HTTP/2 error event received', {
          error: args[1] ? args[1].message : 'Unknown error',
        });
      }
      GlobalDurationTimer.stop();
    };
  }

  static createEmitResponseHandler(
    transactionId: string,
    awsRequestId: string,
    requestData: RequestData,
    requestRandomId: string
  ) {
    logger.debug('HTTP/2 creating emit response handler', {
      transactionId,
      awsRequestId,
      requestRandomId,
      hasRequestData: !!requestData,
    });

    // Ensure requestData has a body property
    if (!requestData) {
      requestData = { body: '' };
      logger.debug('HTTP/2 requestData was not defined in response handler, created empty');
    } else if (requestData.body === undefined) {
      requestData.body = '';
      logger.debug(
        'HTTP/2 requestData.body was undefined in response handler, set to empty string'
      );
    }
    return (response: { headers: {}; statusCode: number }) => {
      logger.debug('HTTP/2 emit response handler called', {
        hasResponse: !!response,
        statusCode: response ? response.statusCode : undefined,
        hasHeaders: response && !!response.headers,
        response: response,
      });

      const onHandler = BaseHttp.createResponseDataWriterHandler({
        transactionId,
        awsRequestId,
        requestData,
        requestRandomId,
        response,
      });
      logger.debug('HTTP/2 hooking response emit events');
    };
  }

  static wrapHttp2Lib(http2Lib) {
    logger.info('HTTP/2 wrapping library');
    console.info('HTTP/2 wrapping library');

    // Hook the connect method which creates a new HTTP/2 session
    logger.info('HTTP/2 hooking connect method');
    extender.hook(http2Lib, 'connect', {
      afterHook: Http2.http2AfterConnectWrapper,
    });

  }

  static hookHttp2() {
    logger.info('HTTP/2 initializing hooks');
    console.log('HTTP/2 initializing hooks');
    Http2.wrapHttp2Lib(http2);
    logger.info('HTTP/2 hooks initialized');
  }
}
