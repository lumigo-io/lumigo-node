import { TracerGlobals } from './globals';
import {
  getEdgeUrl,
  getJSONSize,
  getTracerInfo,
  httpReq,
  isDebug,
  isPruneTraceOff,
} from './utils';
import * as logger from './logger';

export const MAX_SENT_BYTES = 1000 * 1000;

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

export const forgeRequestBody = (spans, maxSendBytes = MAX_SENT_BYTES) => {
  let resultSpans = [];

  if (isPruneTraceOff() || getJSONSize(spans) <= maxSendBytes) {
    return spans.length > 0 ? JSON.stringify(spans) : undefined;
  }

  logger.debug('Starting trim spans before send');

  const functionEndSpan = spans[spans.length - 1];
  const errorSpans = spans.filter(
    span => span.error && span !== functionEndSpan
  );
  const normalSpans = spans.filter(
    span => !span.error && span !== functionEndSpan
  );

  const orderedSpans = [...errorSpans, ...normalSpans];

  for (let errorSpan of orderedSpans) {
    let currentSize = getJSONSize(resultSpans) + getJSONSize(functionEndSpan);
    let spanSize = getJSONSize(errorSpan);

    if (currentSize + spanSize < maxSendBytes) {
      resultSpans.push(errorSpan);
    }
  }

  resultSpans.push(functionEndSpan);

  if (spans.length - resultSpans.length) {
    // eslint-disable-next-line no-console
    console.log(`#LUMIGO# - Trimmed spans due to size`);
  }

  return resultSpans.length > 0 ? JSON.stringify(resultSpans) : undefined;
};
