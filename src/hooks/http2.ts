import { getCurrentTransactionId, getHttpSpan } from '../spans/awsSpan';
import { URL } from 'url';
import { SpansContainer, TracerGlobals } from '../globals';

import * as extender from '../extender';
import * as http2 from 'http2';

import { GlobalDurationTimer } from '../utils/globalDurationTimer';
import { runOneTimeWrapper } from '../utils/functionUtils';
import { BaseHttp, RequestData } from './baseHttp';
import { BasicChildSpan } from '../types/spans/basicSpan';

export class Http2 {
  @GlobalDurationTimer.timedSync()
  static http2RequestArguments(args: any[]): { url?: string; options?: any; callback?: Function } {
    if (args.length === 0) {
      throw new Error('http2.connect(...) was called without any arguments.');
    }

    let url = undefined;
    let options = undefined;
    let callback = undefined;

    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      url = args[0];
      if (args[1]) {
        if (typeof args[1] === 'function') {
          callback = args[1];
        } else {
          options = args[1];
          if (typeof args[2] === 'function') {
            callback = args[2];
          }
        }
      }
    } else {
      options = args[0];
      if (typeof args[1] === 'function') {
        callback = args[1];
      }
    }
    return { url, options, callback };
  }

  static addOptionsToHttp2RequestArguments(originalArgs, newOptions) {
    // We're switching on the different signatures of http2:
    // https://nodejs.org/api/http2.html#http2connectauthority-options-listener
    if (typeof originalArgs[0] === 'string' || originalArgs[0] instanceof URL) {
      if (originalArgs[1]) {
        if (typeof originalArgs[1] === 'function') {
          // The signature is: (url, callback). Change to: (url, options, callback)
          originalArgs.push(originalArgs[1]);
          originalArgs[1] = newOptions;
        } else {
          // The signature is: (url, options) OR (url, options, callback). Doesn't change.
          originalArgs[1] = newOptions;
        }
      } else {
        // The signature is: (url). Change to: (url, options)
        originalArgs.push(newOptions);
      }
    } else {
      // The signature is: (options). Doesn't change.
      originalArgs[0] = newOptions;
    }
  }

  @GlobalDurationTimer.timedSync()
  static http2BeforeRequestWrapper(args, extenderContext) {
    extenderContext.isTracedDisabled = true;
    const { url, options = {} } = Http2.http2RequestArguments(args);
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
      Http2.addOptionsToHttp2RequestArguments(args, options);
    }
    extenderContext.isTracedDisabled = false;
  }

  @GlobalDurationTimer.timedSync()
  static http2AfterRequestWrapper(args, originalFnResult, extenderContext) {
    const clientHttp2Session = originalFnResult;
    const {
      requestData,
      requestRandomId,
      isTracedDisabled,
      awsRequestId,
      transactionId,
      currentSpan,
    } = extenderContext;
    if (isTracedDisabled) {
      return;
    }

    // Hook the request method to capture HTTP/2 requests
    extender.hook(clientHttp2Session, 'request', {
      beforeHook: (args) => {
        const headers = args[0] || {};
        const options = { headers };

        // Use the existing span and request data from the session
        // instead of creating a new one for each request
        // Merge any existing headers with the request headers
        if (headers && requestData && requestData.headers) {
          Object.assign(headers, requestData.headers);
          args[0] = headers;
        }

        // Initialize requestData.body if it doesn't exist
        if (requestData && requestData.body === undefined) {
          requestData.body = '';
        }

        // Store the request data for later use
        return { requestData, requestRandomId, currentSpan };
      },
      afterHook: (args, stream, beforeHookData) => {
        if (!beforeHookData) {
          return;
        }

        const { requestData, requestRandomId, currentSpan } = beforeHookData;

        // Hook stream events to capture request and response data
        const endWrapper = BaseHttp.createRequestDataWriteHandler({ requestData, currentSpan });
        const writeWrapper = BaseHttp.createRequestDataWriteHandler({ requestData, currentSpan });

        extender.hook(stream, 'end', { beforeHook: endWrapper });
        extender.hook(stream, 'write', { beforeHook: writeWrapper });

        // Hook response events
        const emitWrapper = Http2.http2StreamEmitBeforeHookWrapper(
          transactionId,
          awsRequestId,
          requestData,
          requestRandomId,
          currentSpan
        );

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
    // Ensure requestData has a body property
    if (!requestData) {
      requestData = { body: '' };
    } else if (requestData.body === undefined) {
      requestData.body = '';
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
      if (args[0] === 'response') {
        oneTimerEmitResponseHandler(args[1]);
      }
      if (args[0] === 'headers') {
        // For HTTP/2, headers event contains the response headers
        const headers = args[1];
        const statusCode = headers[':status'];
        oneTimerEmitResponseHandler({ headers, statusCode });
      }
      if (args[0] === 'socket') {
        socketWriteRequestHandler(args[1]);
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
    // Ensure requestData has a body property
    if (!requestData) {
      requestData = { body: '' };
    } else if (requestData.body === undefined) {
      requestData.body = '';
    }
    return (response: { headers: {}; statusCode: number }) => {
      const onHandler = BaseHttp.createResponseDataWriterHandler({
        transactionId,
        awsRequestId,
        requestData,
        requestRandomId,
        response,
      });
      extender.hook(response, 'emit', {
        beforeHook: onHandler,
      });
    };
  }

  static wrapHttp2Lib(http2Lib) {
    // Hook the connect method which creates a new HTTP/2 session
    extender.hook(http2Lib, 'connect', {
      beforeHook: Http2.http2BeforeRequestWrapper,
      afterHook: Http2.http2AfterRequestWrapper,
    });

    // Hook the createSecureClient method which also creates a new HTTP/2 session
    if (http2Lib.createSecureClient) {
      extender.hook(http2Lib, 'createSecureClient', {
        beforeHook: Http2.http2BeforeRequestWrapper,
        afterHook: Http2.http2AfterRequestWrapper,
      });
    }

    // Hook the createServer and createSecureServer methods
    if (http2Lib.createServer) {
      extender.hook(http2Lib, 'createServer', {
        afterHook: (args, server) => {
          // Hook the request event to capture incoming requests
          server.on('request', (req, res) => {
            // Implementation for server-side HTTP/2 tracing would go here
            // This is a placeholder for future implementation
          });
        },
      });
    }

    if (http2Lib.createSecureServer) {
      extender.hook(http2Lib, 'createSecureServer', {
        afterHook: (args, server) => {
          // Hook the request event to capture incoming requests
          server.on('request', (req, res) => {
            // Implementation for server-side HTTP/2 tracing would go here
            // This is a placeholder for future implementation
          });
        },
      });
    }
  }

  static hookHttp2() {
    Http2.wrapHttp2Lib(http2);
  }
}
