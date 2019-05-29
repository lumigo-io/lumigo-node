import shimmer from 'shimmer';
import http from 'http';
import { pruneData, isVerboseMode } from '../utils';
import { SpansHive } from '../reporter';
import { getHttpSpan, addResponseDataToHttpSpan } from '../spans/aws_span';

// XXX Blacklist calls to Lumigo's edge
export const isBlacklisted = host => {};

export const parseHttpRequestOptions = options => {
  const host =
    options.host ||
    options.hostname ||
    (options.uri && options.uri.hostname) ||
    'localhost';

  const port = options.port || options.defaultPort || 80;
  const protocol = options.protocol || (port === 443 && 'https:') || 'http:';
  const { headers, body = '', path = '/', method = 'GET' } = options;
  const sendTime = new Date().getTime();

  return {
    path,
    port,
    host,
    method,
    protocol,
    sendTime,
    body,
    headers,
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

  const clientRequest = originalRequestFn.apply(this, [
    options,
    wrappedHttpResponseCallback(requestData, callback),
  ]);
  return clientRequest;
};

export default () => {
  shimmer.wrap(http, 'request', httpRequestWrapper);
};
