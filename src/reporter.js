import { TracerGlobals } from './globals';
import {
  getEdgeUrl,
  getJSONSize,
  getTracerInfo,
  httpReq,
  isDebug,
  isPruneTrace,
} from './utils';
import * as logger from './logger';

export const MAX_SENT_BYTES = 900 * 1000;

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

  const reqBody = forgeRequestBody(spans);

  const roundTripStart = Date.now();

  if (reqBody) {
    await httpReq({ method, headers, host, path }, reqBody);
  }

  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  isDebug() && logSpans(spans);
  return { rtt };
};

export const spliceSpan = spans => {
  if (spans.length > 1) {
   spans.splice(Math.max((spans.length  - 2), 1), 1);
  }
  else {
   spans.splice(0, 1);
  }
};

export const forgeRequestBody = (spans, maxSendBytes = MAX_SENT_BYTES) => {
  let clonedSpans = spans.slice(0);

  if (isPruneTrace()) {
    logger.debug('Starting trim spans before send');

    while (clonedSpans.length > 0 && getJSONSize(clonedSpans) > maxSendBytes) {
      spliceSpan(clonedSpans);
    }

    logger.debug(
      `Trimmed ${spans.length - clonedSpans.length} spans, from ${spans.length}`
    );
  }

  return clonedSpans.length > 0 ? JSON.stringify(clonedSpans) : undefined;
};
