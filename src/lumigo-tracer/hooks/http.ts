import { getCurrentTransactionId, getHttpSpan } from '../spans/awsSpan';
import { URL } from 'url';
import { SpansContainer, TracerGlobals } from '../globals';

import * as extender from '../extender';
import * as http from 'http';
import * as https from 'https';

import { GlobalDurationTimer } from '../utils/globalDurationTimer';
import { runOneTimeWrapper } from '../utils/functionUtils';
import { BaseHttp } from './baseHttp';
import { BasicChildSpan } from '../types/spans/basicSpan';

export type Agent = {
  defaultPort: number;
};

export class Http {
  //////////////////////////////////////////@GlobalDurationTimer.timedSync()
  static httpRequestArguments(args: any[]): { url?: string; options?: any; callback?: Function } {
    if (args.length === 0) {
      throw new Error('http/s.request(...) was called without any arguments.');
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

  static addOptionsToHttpRequestArguments(originalArgs, newOptions) {
    // We're switching on the different signatures of http:
    // https://nodejs.org/api/http.html#httpgeturl-options-callback
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

  //////////////////////////////////////////@GlobalDurationTimer.timedSync()
  static httpBeforeRequestWrapper(args, extenderContext) {
    extenderContext.isTracedDisabled = true;
    const { url, options = {} } = Http.httpRequestArguments(args);
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
      Http.addOptionsToHttpRequestArguments(args, options);
    }
    extenderContext.isTracedDisabled = false;
  }

  //////////////////////////////////////////@GlobalDurationTimer.timedSync()
  static httpAfterRequestWrapper(args, originalFnResult, extenderContext) {
    const clientRequest = originalFnResult;
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

    const endWrapper = BaseHttp.createRequestDataWriteHandler({ requestData, currentSpan });

    const emitWrapper = Http.httpRequestEmitBeforeHookWrapper(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId,
      currentSpan
    );

    const writeWrapper = BaseHttp.createRequestDataWriteHandler({ requestData, currentSpan });

    // Finishes sending the request. If any parts of the body are unsent, it will flush them to the stream.
    // If the request is chunked, this will send the terminating '0\r\n\r\n'.
    // Input is:
    // - data: <string> | <Buffer> | <Uint8Array>
    // - encoding: <string>
    // - callback: <Function>
    // Returns: <this>
    extender.hook(clientRequest, 'end', { beforeHook: endWrapper });

    extender.hook(clientRequest, 'emit', { beforeHook: emitWrapper });

    // Sends a chunk of the body. This method can be called multiple times. If no Content-Length is set,
    // data will automatically be encoded in HTTP Chunked transfer encoding, so that server knows when the data ends.
    // The Transfer-Encoding: chunked header is added.
    // Calling request.end() is necessary to finish sending the request.
    // Input is:
    // - chunk: <string> | <Buffer> | <Uint8Array>
    // - encoding: <string>
    // - callback: <Function>
    // Returns: <boolean>
    extender.hook(clientRequest, 'write', { beforeHook: writeWrapper });
  }

  //////////////////////////////////////////@GlobalDurationTimer.timedSync()
  static addStepFunctionEvent(messageId: string) {
    // @ts-ignore
    const awsRequestId = TracerGlobals.getHandlerInputs().context.awsRequestId;
    const transactionId = getCurrentTransactionId();
    const httpSpan = getHttpSpan(transactionId, awsRequestId, messageId, { sendTime: Date.now() });
    const stepInfo = Object.assign(httpSpan.info, {
      resourceName: 'StepFunction',
      httpInfo: { host: 'StepFunction' },
      messageId: messageId,
    });
    const stepSpan = Object.assign(httpSpan, { info: stepInfo });
    SpansContainer.addSpan(stepSpan);
  }

  static wrapHttpLib(httpLib) {
    extender.hook(httpLib, 'get', {
      beforeHook: Http.httpBeforeRequestWrapper,
      afterHook: Http.httpAfterRequestWrapper,
    });
    extender.hook(httpLib, 'request', {
      beforeHook: Http.httpBeforeRequestWrapper,
      afterHook: Http.httpAfterRequestWrapper,
    });
  }

  static hookHttp() {
    Http.wrapHttpLib(http);
    Http.wrapHttpLib(https);
  }

  static createEmitResponseHandler(
    transactionId: string,
    awsRequestId: string,
    requestData: { body: string },
    requestRandomId: string
  ) {
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

  static httpRequestEmitBeforeHookWrapper(
    transactionId: string,
    awsRequestId: string,
    requestData: { body: string },
    requestRandomId: string,
    currentSpan: BasicChildSpan
  ) {
    const emitResponseHandler = Http.createEmitResponseHandler(
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
      if (args[0] === 'socket') {
        socketWriteRequestHandler(args[1]);
      }
      GlobalDurationTimer.stop();
    };
  }
}
