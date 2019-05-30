import shimmer from 'shimmer';
import http from 'http';
import { pruneData, isVerboseMode } from '../utils';
import { SpansHive } from '../globals';
import { getEdgeHost } from '../reporter';
import { getHttpSpan, addResponseDataToHttpSpan } from '../spans/aws_span';

export const isBlacklisted = host => host === getEdgeHost();

export const parseHttpRequestOptions = options => {
  const host =
    options.host ||
    options.hostname ||
    (options.uri && options.uri.hostname) ||
    'localhost';

  const agent = options.agent || options._defaultAgent;
  const port =
    options.port || options.defaultPort || (agent && agent.defaultPort) || 80;
  const protocol = options.protocol || (port === 443 && 'https:') || 'http:';
  const { headers, body = '', path = '/', method = 'GET' } = options;
  const sendTime = new Date().getTime();

  return {
    path,
    port,
    host,
    body,
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

export const httpRequestWrapper = originalRequestFn => (options, callback) => {
  // XXX Consider try / catch
  // XXX We're currently ignoring the case where the event loop waits for a
  // respose, but the handler ended.

  const requestData = parseHttpRequestOptions(options);
  const { host } = requestData;

  if (isBlacklisted(host)) {
    return originalRequestFn.apply(this, [options, callback]);
  }

  const clientRequest = originalRequestFn.apply(this, [
    options,
    wrappedHttpResponseCallback(requestData, callback),
  ]);
  return clientRequest;
};

export default () => {
  shimmer.wrap(http, 'request', httpRequestWrapper);
};
