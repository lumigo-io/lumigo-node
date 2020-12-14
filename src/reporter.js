import {
  getJSONBase64Size,
  getMaxRequestSize,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  spanHasErrors,
} from './utils';
import * as logger from './logger';
import { HttpSpansAgent } from './httpSpansAgent';
import { DEFAULT_MAX_SIZE_FOR_REQUEST } from './globals';

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
  const reqBody = forgeRequestBody(spans, getMaxRequestSize());

  const roundTripStart = Date.now();
  if (reqBody) {
    await HttpSpansAgent.postSpans(reqBody);
  }
  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  logSpans(rtt, spans);
  return { rtt };
};

export const forgeRequestBody = (spans, maxSendBytes = DEFAULT_MAX_SIZE_FOR_REQUEST) => {
  let resultSpans = [];

  if (isPruneTraceOff() || getJSONBase64Size(spans) <= maxSendBytes) {
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

  if (spans.length - resultSpans.length > 0) {
    logger.debug(`Trimmed spans due to size`);
  }

  return resultSpans.length > 0 ? JSON.stringify(resultSpans) : undefined;
};
