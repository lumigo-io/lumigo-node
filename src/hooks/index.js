import shimmer from 'shimmer';
import http from 'http';
import { isRequestToAwsService, pruneData, isVerboseMode } from '../utils';

export const isWhitelisted = host => {};

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
    body: pruneData(body),
    headers: pruneData(headers),
  };
};

export const wrappedHttpResponseCallback = callback => response => {
  const { headers, statusCode } = response;
  const recievedTime = new Date().getTime();

  let body = '';
  if (isVerboseMode()) {
    response.on('data', chunk => (body += chunk));
  }

  response.on('end', () => {
    const data = {
      body,
      statusCode,
      recievedTime,
      headers: isVerboseMode() ? pruneData(headers) : '',
    };
    // console.log(JSON.stringify(data, null, 2));
  });

  callback && callback(response);
};

export const httpRequestWrapper = originalRequestFn => (options, callback) => {
  const clientRequest = originalRequestFn.apply(this, [
    options,
    wrappedHttpResponseCallback(callback),
  ]);
  return clientRequest;
};

shimmer.wrap(http, 'request', httpRequestWrapper);
