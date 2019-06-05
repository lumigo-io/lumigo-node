import shimmer from 'shimmer';
import http from 'http';
import { SpansHive } from '../globals';
import { getEdgeHost } from '../reporter';
import { getHttpSpan } from '../spans/aws_span';

export const isBlacklisted = host => host === getEdgeHost();

export const getHostFromOptions = options =>
  options.host ||
  options.hostname ||
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
    method,
    headers,
    protocol,
    sendTime,
  };
};

export const wrappedHttpResponseCallback = (
  requestData,
  callback
) => response => {
  const { headers, statusCode } = response;
  const recievedTime = new Date().getTime();

  let body = '';
  response.on('data', chunk => (body += chunk));

  let responseData = {};
  response.on('end', () => {
    responseData = {
      statusCode,
      recievedTime,
      body,
      headers,
    };

    const httpSpan = getHttpSpan(requestData, responseData);
    SpansHive.addSpan(httpSpan);
  });

  callback && callback(response);
};

export const httpRequestEndWrapper = requestData => originalEndFn =>
  // XXX An Arrow function won't work. Dynamic context handling by Node.js.
  function(data, encoding, callback) {
    requestData.body = data;
    return originalEndFn.apply(this, [data, encoding, callback]);
  };

export const httpRequestWrapper = originalRequestFn => (options, callback) => {
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
