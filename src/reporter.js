import { TracerGlobals } from './globals';
import { getEdgeUrl, getTracerInfo, httpReq } from './utils';
import * as logger from './logger';

export const sendSingleSpan = async span => exports.sendSpans([span]);

export const logSpans = spans =>
  spans.map(span => logger.debug('Span sent', span.id));

export const sendSpans = async spans => {
  const { token } = TracerGlobals.getTracerInputs();
  const { name, version } = getTracerInfo();

  const headers = {
    Authorization: token,
    'User-Agent': `${name}$${version}`,
    'Content-Type': 'application/json',
  };

  const method = 'POST';
  const { host, path } = getEdgeUrl();

  logger.debug('Edge selected', { host, path });

  const reqBody = JSON.stringify(spans);
  const roundTripStart = Date.now();

  await httpReq({ method, headers, host, path }, reqBody);

  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  logSpans(spans);
  return { rtt };
};
