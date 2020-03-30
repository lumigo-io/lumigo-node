import shimmer from 'shimmer';
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
  safeExecute,
  getRandomId,
} from '../utils';
import { getHttpSpan } from '../spans/awsSpan';
import cloneResponse from 'clone-response';
import { URL } from 'url';
import { noCirculars } from '../tools/noCirculars';
import * as logger from '../logger';

export const hostBlaclist = new Set(['127.0.0.1']);
export const isBlacklisted = host =>
  host === getEdgeHost() || hostBlaclist.has(host);

export const getHostFromOptionsOrUrl = (options, url) => {
  if (url) {
    return new URL(url).hostname;
  }
  return (
    options.hostname ||
    options.host ||
    (options.uri && options.uri.hostname) ||
    'localhost'
  );
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
    port =
      options.port || options.defaultPort || (agent && agent.defaultPort) || 80;
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
    body: '', // XXX Filled by the httpRequestEndWrapper ( / Write)
    method,
    headers: lowerCaseObjectKeys(headers),
    protocol,
    sendTime,
  };
};

export const wrappedHttpResponseCallback = (
  requestData,
  callback,
  requestRandomId
) => response => {
  const clonedResponse = cloneResponse(response);
  const clonedResponsePassThrough = cloneResponse(response);
  try {
    const { headers, statusCode } = clonedResponse;
    const receivedTime = new Date().getTime();

    let body = '';
    clonedResponse.on('data', chunk => (body += chunk));

    let responseData = {};
    clonedResponse.on(
      'end',
      safeExecute(() => {
        responseData = {
          statusCode,
          receivedTime,
          body,
          headers: lowerCaseObjectKeys(headers),
        };
        const fixedRequestData = noCirculars(requestData);
        const fixedResponseData = noCirculars(responseData);
        const httpSpan = getHttpSpan(
          requestRandomId,
          fixedRequestData,
          fixedResponseData
        );
        SpansContainer.addSpan(httpSpan);
      })
    );
  } catch (err) {
    logger.warn('Failed at wrappedHttpResponseCallback');
  }

  callback && callback(clonedResponsePassThrough);
};

export const httpRequestEndWrapper = requestData => originalEndFn =>
  function(data, encoding, callback) {
    data && (requestData.body += data);
    return originalEndFn.apply(this, [data, encoding, callback]);
  };

export const httpRequestOnWrapper = (
  requestData,
  requestRandomId
) => originalOnFn =>
  function(event, callback) {
    let wrappedCallback = callback;
    if (event === 'response' && callback && !callback.__lumigoSentinel) {
      try {
        wrappedCallback = exports.wrappedHttpResponseCallback(
          requestData,
          callback,
          requestRandomId
        );
        wrappedCallback.__lumigoSentinel = true;
      } catch (err) {
        logger.warn('Failed at wrapping with wrappedHttpResponseCallback', err);
      }
    }
    return originalOnFn.apply(this, [event, wrappedCallback]);
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

  if (typeof args[0] === 'string') {
    url = args[0];
    if (args[1]) {
      if (typeof args[1] === 'function') {
        callback = args[1];
      } else {
        options = args[1];
      }
      if (typeof args[2] === 'function') {
        callback = args[2];
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

export const getHookedClientRequestArgs = (
  url,
  options,
  callback,
  requestData,
  requestRandomId
) => {
  const hookedClientRequestArgs = [];

  !!url && hookedClientRequestArgs.push(url);

  if (options) {
    hookedClientRequestArgs.push(options);
  }

  if (callback) {
    const wrappedCallback = exports.wrappedHttpResponseCallback(
      requestData,
      callback,
      requestRandomId
    );
    wrappedCallback.__lumigoSentinel = true;
    hookedClientRequestArgs.push(wrappedCallback);
  }

  return hookedClientRequestArgs;
};

export const isAlreadyTraced = callback =>
  callback && callback.__lumigoSentinel;

export const httpRequestWrapper = originalRequestFn =>
  function(...args) {
    let url, options, callback, host;
    let isTraceDisabled = true;
    try {
      ({ url, options, callback } = httpRequestArguments(args));
      host = getHostFromOptionsOrUrl(options, url);
      isTraceDisabled = isBlacklisted(host) || isAlreadyTraced(callback);
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
      if (isAwsService(host)) {
        const { awsXAmznTraceId } = getAWSEnvironment();
        const traceId = getPatchedTraceId(awsXAmznTraceId);
        options.headers['X-Amzn-Trace-Id'] = traceId;
      }

      const requestRandomId = getRandomId();

      // try {
      //   const fixedRequestData = noCirculars(requestData);
      //   const fixedResponseData = noCirculars(responseData);
      //   const httpSpan = getHttpSpan(fixedRequestData, fixedResponseData);
      //   SpansContainer.addSpan(httpSpan);
      // } catch (e) {
      //
      // }

      const requestData = parseHttpRequestOptions(options, url);

      const hookedClientRequestArgs = getHookedClientRequestArgs(
        url,
        options,
        callback,
        requestData,
        requestRandomId
      );

      const clientRequest = originalRequestFn.apply(
        this,
        hookedClientRequestArgs
      );

      const endWrapper = httpRequestEndWrapper(requestData, requestRandomId);
      shimmer.wrap(clientRequest, 'end', endWrapper);

      if (!callback) {
        const onWrapper = httpRequestOnWrapper(requestData, requestRandomId);
        shimmer.wrap(clientRequest, 'on', onWrapper);
      }
      return clientRequest;
    } catch (err) {
      // eslint-disable-next-line
      logger.warn('hook error', err);
      return originalRequestFn.apply(this, args);
    }
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
