import shimmer from 'shimmer';
import http from 'http';
import { SpansContainer } from '../globals';
import { getEdgeHost } from '../reporter';
import { lowerCaseObjectKeys } from '../utils';
import { getHttpSpan } from '../spans/awsSpan';
import cloneResponse from 'clone-response';

export const hostBlaclist = new Set(['127.0.0.1']);
export const isBlacklisted = host =>
  host === getEdgeHost() || hostBlaclist.has(host);

export const getHostFromOptions = options =>
  options.hostname ||
  options.host ||
  (options.uri && options.uri.hostname) ||
  'localhost';

export const parseHttpRequestOptions = options => {
  const host = getHostFromOptions(options);
  const agent = options.agent || options._defaultAgent;
  const port =
    options.port || options.defaultPort || (agent && agent.defaultPort) || 80;
  const protocol = options.protocol || (port === 443 && 'https:') || 'http:';

  const { headers, path = '/', method = 'GET' } = options;
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
    requestData.body += data;
    return originalEndFn.apply(this, [data, encoding, callback]);
  };

export const httpRequestWrapper = originalRequestFn =>
  function(options, callback) {
    // TODO try / catch to propagate errors

    // XXX We're currently ignoring the case where the event loop waits for a
    // response, but the handler ended.

    const host = getHostFromOptions(options);

    if (isBlacklisted(host)) {
      return originalRequestFn.apply(this, [options, callback]);
    }

    const requestData = parseHttpRequestOptions(options);
    const clientRequest = originalRequestFn.apply(this, [
      options,
      wrappedHttpResponseCallback(requestData, callback),
    ]);

    shimmer.wrap(clientRequest, 'end', httpRequestEndWrapper(requestData));

    return clientRequest;
  };

export default () => {
  shimmer.wrap(http, 'request', httpRequestWrapper);
};
