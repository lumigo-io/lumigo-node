import { TracerGlobals } from './globals';
import {
  getEdgeUrl,
  getJSONBase64Size,
  getTracerInfo,
  httpReq,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  omitKeys,
  spanHasErrors,
} from './utils';
import * as logger from './logger';
import { isDebug } from './logger';

export const MAX_SENT_BYTES = 1000 * 1000;

export const sendSingleSpan = async span => exports.sendSpans([span]);

export const logSpans = spans => spans.map(span => logger.debug('Span sent', span.id));

export const isSpansContainsErrors = spans => {
  const safeGetStatusCode = s => (s['returnValue'] || {})['statusCode'] || 0;
  const spanHasError = s => s.error !== undefined || safeGetStatusCode(s) > 400;
  return spans.filter(spanHasError).length > 0;
};

export const sendSpans = async spans => {
  const { token } = TracerGlobals.getTracerInputs();
  const { name, version } = getTracerInfo();

  const headers = {
    Authorization: token,
    'User-Agent': `${name}$${version}`,
    'Content-Type': 'application/json',
  };

  if (isSendOnlyIfErrors() && !isSpansContainsErrors(spans)) {
    logger.debug('No Spans was sent, `SEND_ONLY_IF_ERROR` is on and no span has error');
    return { rtt: 0 };
  }

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

  if (isPruneTraceOff() || getJSONBase64Size(spans) <= maxSendBytes) {
    spans = spans.map(omitKeys); // extra validation
    return spans.length > 0 ? JSON.stringify(spans) : undefined;
  }

  logger.debug('Starting trim spans before send');

  const functionEndSpan = spans[spans.length - 1];
  const errorSpans = spans.filter(span => spanHasErrors(span) && span !== functionEndSpan);
  const normalSpans = spans.filter(span => !spanHasErrors(span) && span !== functionEndSpan);

  const orderedSpans = [...errorSpans, ...normalSpans];

  let totalSize = getJSONBase64Size(resultSpans) + getJSONBase64Size(functionEndSpan);

  for (let errorSpan of orderedSpans) {
    let spanSize = getJSONBase64Size(errorSpan);
    if (totalSize + spanSize < maxSendBytes) {
      resultSpans.push(errorSpan);
      totalSize += spanSize;
    }
  }

  resultSpans.push(functionEndSpan);

  resultSpans = resultSpans.map(omitKeys); // extra validation

  if (spans.length - resultSpans.length > 0) {
    logger.debug(`Trimmed spans due to size`);
  }

  return resultSpans.length > 0 ? JSON.stringify(resultSpans) : undefined;
};
