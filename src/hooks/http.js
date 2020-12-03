import * as extender from '../extender';
import http from 'http';
import https from 'https';
import { SpansContainer, TracerGlobals } from '../globals';
import {
  lowerCaseObjectKeys,
  getEdgeHost,
  addHeaders,
  getRandomId,
  isTimeoutTimerEnabled,
  isValidAlias,
  isEmptyString,
  runOneTimeWrapper,
  getEventEntitySize,
  isAwsService,
  getAWSEnvironment,
  getPatchedTraceId,
  isKeepHeadersOn,
} from '../utils';
import * as logger from '../logger';
import { getCurrentTransactionId, getHttpInfo, getHttpSpan } from '../spans/awsSpan';
import { URL } from 'url';
import {
  extractBodyFromEmitSocketEvent,
  extractBodyFromEndFunc,
  extractBodyFromWriteFunc,
} from './httpUtils';

export const hostBlaclist = new Set(['127.0.0.1']);
export const isBlacklisted = host => host === getEdgeHost() || hostBlaclist.has(host);

export const getHostFromOptionsOrUrl = (options, url) => {
  if (url) {
    return new URL(url).hostname;
  }
  return options.hostname || options.host || (options.uri && options.uri.hostname) || 'localhost';
};

export const parseHttpRequestOptions = (options = {}, url) => {
  const host = getHostFromOptionsOrUrl(options, url);
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
};

export const httpRequestWriteBeforeHookWrapper = (requestData, currentSpan) =>
  function(args) {
    if (isEmptyString(requestData.body)) {
      const body = extractBodyFromWriteFunc(args);
      if (body) {
        requestData.body += body;
        if (currentSpan) currentSpan.info.httpInfo = getHttpInfo(requestData);
      }
    }
  };

export const httpRequestEmitBeforeHookWrapper = (
  transactionId,
  awsRequestId,
  requestData,
  requestRandomId,
  currentSpan
) => {
  const oneTimerEmitResponseHandler = runOneTimeWrapper(
    createEmitResponseHandler(transactionId, awsRequestId, requestData, requestRandomId)
  );
  return function(args) {
    if (args[0] === 'response') {
      oneTimerEmitResponseHandler(args[1]);
    }
    if (args[0] === 'socket') {
      if (isEmptyString(requestData.body)) {
        const body = extractBodyFromEmitSocketEvent(args[1]);
        if (body) {
          requestData.body += body;
          if (currentSpan) currentSpan.info.httpInfo = getHttpInfo(requestData);
        }
      }
    }
  };
};

const createEmitResponseOnEmitBeforeHookHandler = (
  transactionId,
  awsRequestId,
  requestData,
  requestRandomId,
  response
) => {
  let body = '';
  const payloadSize = getEventEntitySize();
  return function(args) {
    const receivedTime = new Date().getTime();
    const { headers, statusCode } = response;
    if (args[0] === 'data') {
      if (body.length + args[1].length <= payloadSize) {
        body += args[1];
      }
    }
    if (args[0] === 'end') {
      const responseData = {
        statusCode,
        receivedTime,
        body,
        headers: lowerCaseObjectKeys(headers),
      };
      const httpSpan = getHttpSpan(
        transactionId,
        awsRequestId,
        requestRandomId,
        requestData,
        responseData
      );
      if (httpSpan.id !== requestRandomId) {
        // In this case, one of our parser decide to change the spanId for async connection
        SpansContainer.changeSpanId(requestRandomId, httpSpan.id);
      }
      SpansContainer.addSpan(httpSpan);
    }
  };
};

export const createEmitResponseHandler = (
  transactionId,
  awsRequestId,
  requestData,
  requestRandomId
) => response => {
  const onHandler = createEmitResponseOnEmitBeforeHookHandler(
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

export const httpRequestEndWrapper = (requestData, currentSpan) =>
  function(args) {
    if (isEmptyString(requestData.body)) {
      const body = extractBodyFromEndFunc(args);
      if (body) {
        requestData.body += body;
      }
      if (currentSpan) currentSpan.info.httpInfo = getHttpInfo(requestData);
    }
  };

// http/s.request can be called with either (options, callback) or (url, options, callback)
// See: https://github.com/nodejs/node/blob/01b404f629d91af8a720c51e90895bf0c07b0d6d/lib/_http_client.js#L76
export const httpRequestArguments = args => {
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
};

export const httpBeforeRequestWrapper = (args, extenderContext) => {
  const { awsRequestId } = TracerGlobals.getHandlerInputs().context;
  const transactionId = getCurrentTransactionId();
  extenderContext.isTracedDisabled = true;
  extenderContext.awsRequestId = awsRequestId;
  extenderContext.transactionId = transactionId;

  const { url, options } = httpRequestArguments(args);
  const { headers } = options || {};
  const host = getHostFromOptionsOrUrl(options, url);
  extenderContext.isTracedDisabled = isBlacklisted(host) || !isValidAlias();

  if (!extenderContext.isTracedDisabled) {
    logger.debug('Starting hook', { host, url, headers });

    const isRequestToAwsService = isAwsService(host);
    if (isRequestToAwsService && !isKeepHeadersOn()) {
      const { awsXAmznTraceId } = getAWSEnvironment();
      const traceId = getPatchedTraceId(awsXAmznTraceId);
      options.headers['X-Amzn-Trace-Id'] = traceId;
    }

    const requestData = parseHttpRequestOptions(options, url);
    const requestRandomId = getRandomId();

    extenderContext.requestRandomId = requestRandomId;
    extenderContext.requestData = requestData;

    if (isTimeoutTimerEnabled()) {
      const httpSpan = getHttpSpan(transactionId, awsRequestId, requestRandomId, requestData);
      SpansContainer.addSpan(httpSpan);
      extenderContext.currentSpan = httpSpan;
    }
  }
};

export const httpAfterRequestWrapper = (args, originalFnResult, extenderContext) => {
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
    const endWrapper = httpRequestEndWrapper(requestData, currentSpan);
    extender.hook(clientRequest, 'end', { beforeHook: endWrapper });

    const emitWrapper = httpRequestEmitBeforeHookWrapper(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId,
      currentSpan
    );
    extender.hook(clientRequest, 'emit', { beforeHook: emitWrapper });

    const writeWrapper = httpRequestWriteBeforeHookWrapper(requestData, currentSpan);
    extender.hook(clientRequest, 'write', { beforeHook: writeWrapper });
  }
};

export const addStepFunctionEvent = messageId => {
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
};

export const wrapHttp = httpLib => {
  extender.hook(httpLib, 'get', {
    beforeHook: httpBeforeRequestWrapper,
    afterHook: httpAfterRequestWrapper,
  });
  extender.hook(httpLib, 'request', {
    beforeHook: httpBeforeRequestWrapper,
    afterHook: httpAfterRequestWrapper,
  });
};

export default () => {
  wrapHttp(http);
  wrapHttp(https);
};
