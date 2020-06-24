import shimmer from 'shimmer';
import * as extender from '../extender';
import http from 'http';
import https from 'https';
import { SpansContainer } from '../globals';
import {
  getAWSEnvironment,
  getPatchedTraceId,
  lowerCaseObjectKeys,
  isAwsService,
  getEdgeHost,
  addHeaders,
  getRandomId,
  isTimeoutTimerEnabled,
  isValidAlias,
  isEmptyString,
  runOneTimeWrapper,
} from '../utils';
import { getHttpSpan } from '../spans/awsSpan';
import { URL } from 'url';
import { noCirculars } from '../tools/noCirculars';
import * as logger from '../logger';
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
    body: '', // XXX Filled by the httpRequestEndWrapper or httpRequestEmitWrapper ( / Write)
    method,
    headers: lowerCaseObjectKeys(headers),
    protocol,
    sendTime,
  };
};

export const httpRequestWriteWrapper = requestData =>
  function(args) {
    if (isEmptyString(requestData.body)) {
      const body = extractBodyFromWriteFunc(args);
      if (body) requestData.body += body;
    }
  };

export const httpRequestEmitWrapper = (requestData, requestRandomId) => {
  const oneTimerEmitResponseHandler = runOneTimeWrapper(
    createEmitResponseHandler(requestData, requestRandomId)
  );
  return function(args) {
    if (args[0] === 'response') {
      oneTimerEmitResponseHandler(args[1]);
    }
    if (args[0] === 'socket') {
      if (isEmptyString(requestData.body)) {
        const body = extractBodyFromEmitSocketEvent(args[1]);
        requestData.body += body;
      }
    }
  };
};

const createEmitResponseOnEmitHandler = (requestData, requestRandomId, response) => {
  const { headers, statusCode } = response;
  const receivedTime = new Date().getTime();
  let body = '';
  let responseData = {};
  return function(args) {
    if (args[0] === 'data') {
      body += args[1];
    }
    if (args[0] === 'end') {
      responseData = {
        statusCode,
        receivedTime,
        body,
        headers: lowerCaseObjectKeys(headers),
      };
      const fixedRequestData = noCirculars(requestData);
      const fixedResponseData = noCirculars(responseData);
      const httpSpan = getHttpSpan(requestRandomId, fixedRequestData, fixedResponseData);
      SpansContainer.addSpan(httpSpan);
    }
  };
};

export const createEmitResponseHandler = (requestData, requestRandomId) => response => {
  const onHandler = createEmitResponseOnEmitHandler(requestData, requestRandomId, response);
  extender.hook(response, 'emit', {
    beforeHook: onHandler,
  });
};

export const httpRequestEndWrapper = requestData =>
  function(args) {
    if (isEmptyString(requestData.body)) {
      const body = extractBodyFromEndFunc(args);
      requestData.body += body;
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

const functionIsAlreadyWrapped = originalRequestFn =>
  !!(originalRequestFn && originalRequestFn.__wrapped);

export const httpRequestWrapper = originalRequestFn => {
  if (functionIsAlreadyWrapped(originalRequestFn)) return originalRequestFn;
  return function(...args) {
    let url, options, host;
    let isTraceDisabled = true;
    try {
      ({ url, options } = httpRequestArguments(args));
      host = getHostFromOptionsOrUrl(options, url);
      isTraceDisabled = isBlacklisted(host) || !isValidAlias();
    } catch (err) {
      logger.warn('request parsing error', err);
    }

    if (isTraceDisabled) {
      return originalRequestFn.apply(this, args);
    }

    try {
      const headers = options.headers;
      logger.debug('Starting hook', { host, url, headers });
      // XXX Create a pure function - something like: 'patchOptionsForAWSService'
      // return the patched options
      const isRequestToAwsService = isAwsService(host);
      if (isRequestToAwsService) {
        const { awsXAmznTraceId } = getAWSEnvironment();
        const traceId = getPatchedTraceId(awsXAmznTraceId);
        options.headers['X-Amzn-Trace-Id'] = traceId;
      }

      const requestData = parseHttpRequestOptions(options, url);
      const requestRandomId = getRandomId();

      if (isTimeoutTimerEnabled()) {
        const fixedRequestData = noCirculars(requestData);
        const httpSpan = getHttpSpan(requestRandomId, fixedRequestData);
        SpansContainer.addSpan(httpSpan);
      }

      const clientRequest = originalRequestFn.apply(this, args);

      const endWrapper = httpRequestEndWrapper(requestData, requestRandomId);
      extender.hook(clientRequest, 'end', { beforeHook: endWrapper });

      const emitWrapper = httpRequestEmitWrapper(requestData, requestRandomId);
      extender.hook(clientRequest, 'emit', { beforeHook: emitWrapper });

      const writeWrapper = httpRequestWriteWrapper(requestData);
      extender.hook(clientRequest, 'write', { beforeHook: writeWrapper });

      return clientRequest;
    } catch (err) {
      // eslint-disable-next-line
      logger.warn('hook error', err.message);
      return originalRequestFn.apply(this, args);
    }
  };
};

export const httpGetWrapper = httpModule => (/* originalGetFn */) =>
  function(...args) {
    const req = httpModule.request(...args);
    req.end();
    return req;
  };

export const addStepFunctionEvent = messageId => {
  const httpSpan = getHttpSpan(messageId, {});
  const stepInfo = Object.assign(httpSpan.info, {
    resourceName: 'StepFunction',
    httpInfo: { host: 'StepFunction' },
    messageId: messageId,
  });
  const stepSpan = Object.assign(httpSpan, { info: stepInfo });
  SpansContainer.addSpan(stepSpan);
};

export default () => {
  shimmer.wrap(http, 'get', httpGetWrapper(http));
  shimmer.wrap(https, 'get', httpGetWrapper(https));
  shimmer.wrap(http, 'request', httpRequestWrapper);
  shimmer.wrap(https, 'request', httpRequestWrapper);
};
