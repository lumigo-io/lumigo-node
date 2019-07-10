import shimmer from 'shimmer';
import http from 'http';
import https from 'https';
import { SpansContainer } from '../globals';
import { getEdgeHost } from '../reporter';
import {
  getAWSEnvironment,
  getPatchedTraceId,
  lowerCaseObjectKeys,
  isRequestToAwsService,
} from '../utils';
import { getHttpSpan } from '../spans/awsSpan';
import cloneResponse from 'clone-response';
import { URL } from 'url';

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

  if (url) {
    const myUrl = new URL(url);
    ({ pathname: path, port, protocol } = myUrl);
  } else {
    path = options.path || '/';
    port =
      options.port || options.defaultPort || (agent && agent.defaultPort) || 80;
    protocol = options.protocol || (port === 443 && 'https:') || 'http:';
  }

  const { headers, method = 'GET' } = options;
  const sendTime = new Date().getTime();

  return {
    path,
    port,
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
  callback
) => response => {
  const clonedResponse = cloneResponse(response);
  const clonedResponsePassThrough = cloneResponse(response);
  const { headers, statusCode } = clonedResponse;
  const receivedTime = new Date().getTime();

  let body = '';
  clonedResponse.on('data', chunk => (body += chunk));

  let responseData = {};
  clonedResponse.on('end', () => {
    responseData = {
      statusCode,
      receivedTime,
      body,
      headers: lowerCaseObjectKeys(headers),
    };
    const httpSpan = getHttpSpan(requestData, responseData);
    SpansContainer.addSpan(httpSpan);
  });

  callback && callback(clonedResponsePassThrough);
};

export const httpRequestEndWrapper = requestData => originalEndFn =>
  function(data, encoding, callback) {
    data && (requestData.body += data);
    return originalEndFn.apply(this, [data, encoding, callback]);
  };

export const httpRequestOnWrapper = requestData => originalOnFn =>
  function(event, callback) {
    if (event === 'response' && callback && !callback.__lumigoSentinel) {
      const wrappedCallback = exports.wrappedHttpResponseCallback(
        requestData,
        callback
      );
      wrappedCallback.__lumigoSentinel = true;

      return originalOnFn.apply(this, [event, wrappedCallback]);
    }
    return originalOnFn.apply(this, [event, callback]);
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
  requestData
) => {
  const hookedClientRequestArgs = [];

  !!url && hookedClientRequestArgs.push(url);

  if (options) {
    const host = getHostFromOptionsOrUrl(options, url);
    if (isRequestToAwsService(host)) {
      const { awsXAmznTraceId } = getAWSEnvironment();
      options.headers['X-Amzn-Trace-Id'] = getPatchedTraceId(awsXAmznTraceId);
    }

    hookedClientRequestArgs.push(options);
  }

  if (callback) {
    const wrappedCallback = exports.wrappedHttpResponseCallback(
      requestData,
      callback
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
    // TODO try / catch to propagate errors

    // XXX We're currently ignoring the case where the event loop waits for a
    // response, but the handler ended.

    const { url, options, callback } = httpRequestArguments(args);
    const host = getHostFromOptionsOrUrl(options, url);

    if (isBlacklisted(host) || isAlreadyTraced(callback)) {
      return originalRequestFn.apply(this, args);
    }

    const requestData = parseHttpRequestOptions(options, url);

    const hookedClientRequestArgs = getHookedClientRequestArgs(
      url,
      options,
      callback,
      requestData
    );

    const clientRequest = originalRequestFn.apply(
      this,
      hookedClientRequestArgs
    );

    shimmer.wrap(clientRequest, 'end', httpRequestEndWrapper(requestData));

    if (!callback) {
      shimmer.wrap(clientRequest, 'on', httpRequestOnWrapper(requestData));
    }

    return clientRequest;
  };

export const httpGetWrapper = httpModule => (/* originalGetFn */) =>
  function(...args) {
    const req = httpModule.request(...args);
    req.end();
    return req;
  };

export default () => {
  shimmer.wrap(http, 'get', httpGetWrapper(http));
  shimmer.wrap(https, 'get', httpGetWrapper(https));
  shimmer.wrap(http, 'request', httpRequestWrapper);
  shimmer.wrap(https, 'request', httpRequestWrapper);
};
