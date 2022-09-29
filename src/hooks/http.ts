import {
  addHeaders,
  getAWSEnvironment,
  getEdgeHost,
  getEventEntitySize,
  getPatchedTraceId,
  getRandomId,
  isAwsService,
  isEmptyString,
  isKeepHeadersOn,
  isTimeoutTimerEnabled,
  isValidAlias,
  lowerCaseObjectKeys,
  safeExecute,
  shouldPropagateW3C,
} from '../utils';
import { extractBodyFromEmitSocketEvent, extractBodyFromWriteOrEndFunc } from './httpUtils';
import {
  ServiceData,
  getServiceData,
  getCurrentTransactionId,
  getHttpInfo,
  getHttpSpan,
} from '../spans/awsSpan';
import { URL } from 'url';
import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';

import * as extender from '../extender';
import * as http from 'http';
import * as https from 'https';
import { GlobalDurationTimer } from '../utils/globalDurationTimer';
import { runOneTimeWrapper } from '../utils/functionUtils';
import { addW3CTracePropagator } from '../utils/w3cUtils';

export const hostBlaclist = new Set(['127.0.0.1']);

export type Agent = {
  defaultPort: number;
};

export type ParseHttpRequestOptions = {
  agent?: Agent;
  _defaultAgent?: Agent;
  // eslint-disable-next-line no-undef
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  protocol?: string;
  path?: string;
  port?: number;
  defaultPort?: number;
};

export class Http {
  static httpRequestEndWrapper(requestData, currentSpan) {
    return function (args) {
      GlobalDurationTimer.start();
      if (isEmptyString(requestData.body)) {
        const body = extractBodyFromWriteOrEndFunc(args);
        Http.aggregateRequestBodyToSpan(body, requestData, currentSpan, getEventEntitySize(true));
      }
      GlobalDurationTimer.stop();
    };
  }

  static aggregateRequestBodyToSpan(
    body,
    requestData,
    currentSpan,
    maxSize = getEventEntitySize(true)
  ) {
    let serviceData: ServiceData = {};
    if (body && !requestData.truncated) {
      requestData.body += body;
      serviceData = getServiceData(requestData, null);
      const truncated = maxSize < requestData.body.length;
      if (truncated) requestData.body = requestData.body.substr(0, maxSize);
      requestData.truncated = truncated;
    }
    if (currentSpan) {
      currentSpan.info.httpInfo = getHttpInfo(requestData, {});
      Object.assign(currentSpan.info, {
        ...serviceData.awsServiceData,
      });
    }
  }

  @GlobalDurationTimer.timedSync()
  static httpRequestArguments(args) {
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
  @GlobalDurationTimer.timedSync()
  static getHostFromOptionsOrUrl(options, url) {
    if (url) {
      return new URL(url).hostname;
    }
    return options.hostname || options.host || (options.uri && options.uri.hostname) || 'localhost';
  }

  static addOptionsToHttpRequestArguments(originalArgs, newOptions) {
    // We're switching on the different signatures of http:
    // https://nodejs.org/api/http.html#httpgeturl-options-callback
    if (typeof originalArgs[0] === 'string' || originalArgs[0] instanceof URL) {
      if (originalArgs[1]) {
        if (typeof originalArgs[1] === 'function') {
          // The signature is: (url, callback)
          originalArgs.push(originalArgs[1]);
          originalArgs[1] = newOptions;
        } else {
          // The signature is: (url, options) OR (url, options, callback)
          originalArgs[1] = newOptions;
        }
      } else {
        // The signature is: (url)
        originalArgs.push(newOptions);
      }
    } else {
      // The signature is: (options)
      originalArgs[0] = newOptions;
    }
  }

  static isBlacklisted(host) {
    return host === getEdgeHost() || hostBlaclist.has(host);
  }

  @GlobalDurationTimer.timedSync()
  static parseHttpRequestOptions(options: ParseHttpRequestOptions = {}, url) {
    const host = Http.getHostFromOptionsOrUrl(options, url);
    const agent = options.agent || options._defaultAgent;

    let path = null;
    let port = null;
    let protocol = null;

    let { headers, method = 'GET' } = options;
    const sendTime = new Date().getTime();

    if (url) {
      const myUrl = new URL(url);
      ({ pathname: path, port, protocol } = myUrl);
    } else {
      path = options.path || '/';
      port = options.port || options.defaultPort || (agent && agent.defaultPort) || 80;
      protocol = options.protocol || (port === 443 && 'https:') || 'http:';
    }

    if (headers && !headers.host) {
      headers = addHeaders(headers, { host });
    }

    const uri = `${host}${path}`;

    return {
      truncated: false,
      path,
      port,
      uri,
      host,
      body: '', // XXX Filled by the httpRequestEndWrapper or httpRequestEmitBeforeHookWrapper ( / Write)
      method,
      headers: lowerCaseObjectKeys(headers),
      protocol,
      sendTime,
    };
  }

  @GlobalDurationTimer.timedSync()
  static httpBeforeRequestWrapper(args, extenderContext) {
    extenderContext.isTracedDisabled = true;
    // @ts-ignore
    const { awsRequestId } = TracerGlobals.getHandlerInputs().context;
    const transactionId = getCurrentTransactionId();
    extenderContext.awsRequestId = awsRequestId;
    extenderContext.transactionId = transactionId;
    extenderContext.isTracedDisabled = false;

    const { url, options = {} } = Http.httpRequestArguments(args);
    const headers = options?.headers || {};
    const host = Http.getHostFromOptionsOrUrl(options, url);
    extenderContext.isTracedDisabled =
      Http.isBlacklisted(host) || !isValidAlias() || GlobalDurationTimer.isTimePassed();

    if (!extenderContext.isTracedDisabled) {
      logger.debug('Starting hook', { host, url, headers });

      const isRequestToAwsService = isAwsService(host);
      if (isRequestToAwsService && !isKeepHeadersOn()) {
        const { awsXAmznTraceId } = getAWSEnvironment();
        const traceId = getPatchedTraceId(awsXAmznTraceId);
        headers && (headers['X-Amzn-Trace-Id'] = traceId);
      }

      if (shouldPropagateW3C()) {
        safeExecute(() => {
          options.headers = addW3CTracePropagator(headers);
          Http.addOptionsToHttpRequestArguments(args, options);
        })();
      }

      const requestData = Http.parseHttpRequestOptions(options, url);
      const requestRandomId = getRandomId();

      extenderContext.requestRandomId = requestRandomId;
      extenderContext.requestData = requestData;

      if (isTimeoutTimerEnabled()) {
        const httpSpan = getHttpSpan(transactionId, awsRequestId, requestRandomId, requestData);
        SpansContainer.addSpan(httpSpan);
        extenderContext.currentSpan = httpSpan;
      }
    }
  }

  @GlobalDurationTimer.timedSync()
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
    if (!isTracedDisabled) {
      const endWrapper = Http.httpRequestEndWrapper(requestData, currentSpan);

      const emitWrapper = Http.httpRequestEmitBeforeHookWrapper(
        transactionId,
        awsRequestId,
        requestData,
        requestRandomId,
        currentSpan
      );

      const writeWrapper = Http.httpRequestWriteBeforeHookWrapper(requestData, currentSpan);

      extender.hook(clientRequest, 'end', { beforeHook: endWrapper });
      extender.hook(clientRequest, 'emit', { beforeHook: emitWrapper });
      extender.hook(clientRequest, 'write', { beforeHook: writeWrapper });
    }
  }

  static httpRequestWriteBeforeHookWrapper(requestData, currentSpan) {
    return function (args) {
      GlobalDurationTimer.start();
      if (isEmptyString(requestData.body)) {
        const body = extractBodyFromWriteOrEndFunc(args);
        Http.aggregateRequestBodyToSpan(body, requestData, currentSpan, getEventEntitySize(true));
      }
      GlobalDurationTimer.stop();
    };
  }

  @GlobalDurationTimer.timedSync()
  static addStepFunctionEvent(messageId) {
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

  static createEmitResponseOnEmitBeforeHookHandler(
    transactionId,
    awsRequestId,
    requestData,
    requestRandomId,
    response
  ) {
    let body = '';
    let maxPayloadSize = getEventEntitySize(true);
    return function (args) {
      GlobalDurationTimer.start();
      const receivedTime = new Date().getTime();
      let truncated = false;
      const { headers, statusCode } = response;
      // add to body only if we didnt pass the max size
      if (args[0] === 'data' && body.length < maxPayloadSize) {
        let chunk = args[1].toString();
        const allowedLengthToAdd = maxPayloadSize - body.length;
        //if we reached or close to limit get only substring of the part to reach the limit
        if (chunk.length > allowedLengthToAdd) {
          truncated = true;
          chunk = chunk.substr(0, allowedLengthToAdd);
        }
        body += chunk;
      }
      if (args[0] === 'end') {
        let maxSizeNoErrors = getEventEntitySize();
        const responseData = {
          statusCode,
          receivedTime,
          body:
            statusCode < 400 && body.length > maxSizeNoErrors // if there are no errors cut the size to max allowed with no errors
              ? body.substr(0, maxSizeNoErrors)
              : body,
          headers: lowerCaseObjectKeys(headers),
        };
        const httpSpan = getHttpSpan(
          transactionId,
          awsRequestId,
          requestRandomId,
          requestData,
          Object.assign({ truncated }, responseData)
        );
        if (httpSpan.id !== requestRandomId) {
          // In Http case, one of our parser decide to change the spanId for async connection
          SpansContainer.changeSpanId(requestRandomId, httpSpan.id);
        }
        SpansContainer.addSpan(httpSpan);
      }
      GlobalDurationTimer.stop();
    };
  }

  static createEmitResponseHandler(transactionId, awsRequestId, requestData, requestRandomId) {
    return (response) => {
      const onHandler = Http.createEmitResponseOnEmitBeforeHookHandler(
        transactionId,
        awsRequestId,
        requestData,
        requestRandomId,
        response
      );
      extender.hook(response, 'emit', {
        beforeHook: onHandler,
      });
    };
  }

  static httpRequestEmitBeforeHookWrapper(
    transactionId,
    awsRequestId,
    requestData,
    requestRandomId,
    currentSpan
  ) {
    const emitResponseHandler = Http.createEmitResponseHandler(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId
    );
    const oneTimerEmitResponseHandler = runOneTimeWrapper(emitResponseHandler, {});
    return function (args) {
      GlobalDurationTimer.start();
      if (args[0] === 'response') {
        oneTimerEmitResponseHandler(args[1]);
      }
      if (args[0] === 'socket') {
        if (isEmptyString(requestData.body)) {
          const body = extractBodyFromEmitSocketEvent(args[1]);
          Http.aggregateRequestBodyToSpan(body, requestData, currentSpan, getEventEntitySize(true));
        }
      }
      GlobalDurationTimer.stop();
    };
  }
}
