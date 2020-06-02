import { TracerGlobals } from './globals';
import {
  getEdgeUrl,
  getJSONBase64Size,
  getRandomId,
  getTracerInfo,
  httpReq,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  omitKeys,
  spanHasErrors,
} from './utils';
import * as logger from './logger';
import { isDebug } from './logger';
import { TracerTimer } from './timer';

export const MAX_SENT_BYTES = 1000 * 1000;

export const sendSingleSpan = async span => exports.sendSpans([span]);

export const logSpans = spans =>
  spans.map(span => logger.debug('Span sent', span.id));

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

  TracerTimer.startJob('isSpansContainsErrors');
  if (isSendOnlyIfErrors() && !isSpansContainsErrors(spans)) {
    logger.debug(
      'No Spans was sent, `SEND_ONLY_IF_ERROR` is on and no span has error'
    );
    return { rtt: 0 };
  }
  TracerTimer.endJob('isSpansContainsErrors');

  const method = 'POST';
  const { host, path } = getEdgeUrl();

  logger.debug('Edge selected', { host, path });

  const randomId = getRandomId();
  TracerTimer.startJob('forgeRequestBody', randomId);

  const reqBody = forgeRequestBody(spans);
  TracerTimer.endJob('forgeRequestBody', randomId);

  const roundTripStart = Date.now();

  if (reqBody) {
    const randomId = getRandomId();
    TracerTimer.startJob('httpReq', randomId);
    await httpReq({ method, headers, host, path }, reqBody);
    TracerTimer.endJob('httpReq', randomId);
  }

  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  TracerTimer.startJob('logSpans');
  isDebug() && logSpans(spans);
  TracerTimer.endJob('logSpans');
  return { rtt };
};

export const forgeRequestBody = (spans, maxSendBytes = MAX_SENT_BYTES) => {
  let resultSpans = [];
  TracerTimer.startJob('JSON.stringify(spans)');
  if (isPruneTraceOff() || getJSONBase64Size(spans) <= maxSendBytes) {
    return spans.length > 0 ? JSON.stringify(spans) : undefined;
  }
  TracerTimer.endJob('JSON.stringify(spans)');

  logger.debug('Starting trim spans before send');

  TracerTimer.startJob('spanHasErrors');
  const functionEndSpan = spans[spans.length - 1];
  const errorSpans = spans.filter(
    span => spanHasErrors(span) && span !== functionEndSpan
  );
  const normalSpans = spans.filter(
    span => !spanHasErrors(span) && span !== functionEndSpan
  );

  const orderedSpans = [...errorSpans, ...normalSpans];
  TracerTimer.endJob('spanHasErrors');

  TracerTimer.startJob('getJSONBase64Size');
  let totalSize =
    getJSONBase64Size(resultSpans) + getJSONBase64Size(functionEndSpan);
  for (let errorSpan of orderedSpans) {
    let spanSize = getJSONBase64Size(errorSpan);
    if (totalSize + spanSize < maxSendBytes) {
      resultSpans.push(errorSpan);
      totalSize += spanSize;
    }
  }
  TracerTimer.endJob('getJSONBase64Size');

  resultSpans.push(functionEndSpan);
  console.log(`About to send ${resultSpans.length} spans, size: ${totalSize}`);

  TracerTimer.startJob('omitKeys');
  resultSpans = resultSpans.map(omitKeys); // extra validation
  TracerTimer.endJob('omitKeys');

  if (spans.length - resultSpans.length > 0) {
    logger.debug(`Trimmed spans due to size`);
  }

  return resultSpans.length > 0 ? JSON.stringify(resultSpans) : undefined;
};
