import {
  getJSONBase64Size,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  omitKeys,
  spanHasErrors,
} from './utils';
import * as logger from './logger';
import { HttpSpansAgent } from './httpSpansAgent';
import { HttpAgent } from './httpAgent';

export const MAX_SENT_BYTES = 1000 * 1000;

export const sendSingleSpan = async span => exports.sendSpans([span]);

export const logSpans = (rtt, spans) => {
  const spanIds = spans.map(span => span.id);
  logger.debug(`Spans sent [${rtt}ms]`, spanIds);
};

export const isSpansContainsErrors = spans => {
  const safeGetStatusCode = s => (s['returnValue'] || {})['statusCode'] || 0;
  const spanHasError = s => s.error !== undefined || safeGetStatusCode(s) > 400;
  return spans.filter(spanHasError).length > 0;
};

export const sendSpans = async spans => {
  if (isSendOnlyIfErrors() && !isSpansContainsErrors(spans)) {
    logger.debug('No Spans was sent, `SEND_ONLY_IF_ERROR` is on and no span has error');
    return { rtt: 0 };
  }
  const reqBody = forgeRequestBody(spans);

  const roundTripStart = Date.now();
  if (reqBody) {
    await HttpSpansAgent.postSpans(reqBody);
  }
  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  logSpans(rtt, spans);
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
