import {
  getEventEntitySize,
  getJSONBase64Size,
  getMaxRequestSize,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  isString,
  spanHasErrors,
} from './utils';
import * as logger from './logger';
import { HttpSpansAgent } from './httpSpansAgent';
import { payloadStringify } from './utils/payloadStringify';
import { decodeHttpBody, isContainingSecrets } from './spans/awsSpan';
import untruncateJson from './tools/untrancateJson';
export const NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION = 200;

export const sendSingleSpan = async (span) => sendSpans([span]);

export const logSpans = (rtt: number, spans): void => {
  const spanIds = spans.map((span) => span.id);
  logger.debug(`Spans sent [${rtt}ms]`, spanIds);
};

export const isSpansContainsErrors = (spans): boolean => {
  const safeGetStatusCode = (s) => (s['returnValue'] || {})['statusCode'] || 0;
  const spanHasError = (s) => s.error !== undefined || safeGetStatusCode(s) > 400;
  return spans.filter(spanHasError).length > 0;
};

export const sendSpans = async (spans): Promise<void> => {
  if (isSendOnlyIfErrors() && !isSpansContainsErrors(spans)) {
    logger.debug('No Spans was sent, `SEND_ONLY_IF_ERROR` is on and no span has error');
    return;
  }
  const reqBody = forgeRequestBody(spans, getMaxRequestSize());

  const roundTripStart = Date.now();
  if (reqBody) {
    await HttpSpansAgent.postSpans(reqBody);
  }
  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  logSpans(rtt, spans);
};

export const shouldTrim = (spans, maxSendBytes: number): boolean => {
  return (
    spans.length > NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION || getJSONBase64Size(spans) > maxSendBytes
  );
};

const isJsonContent = (payload: any, headers: Object) => {
  return isString(payload) && headers['content-type'] && headers['content-type'].includes('json');
};

function scrub(payload, headers, sizeLimit: number): string {
  try {
    if (isJsonContent(payload, headers) && isContainingSecrets(payload)) {
      if (!(payload.length < sizeLimit)) {
        payload = untruncateJson(payload);
      }
      return payloadStringify(JSON.parse(payload), sizeLimit);
    } else {
      return payloadStringify(payload, sizeLimit);
    }
  } catch (e) {
    return payloadStringify(payload, sizeLimit);
  }
}

export const forgeRequestBody = (spans, maxSendBytes): string | undefined => {
  let resultSpans = [];

  logger.debug(`Starting trim spans [${spans.length}] bigger than: [${maxSendBytes}] before send`);
  const start = new Date().getTime();
  const functionEndSpan = spans[spans.length - 1];
  const errorSpans = spans.filter((span) => spanHasErrors(span) && span !== functionEndSpan);
  const normalSpans = spans.filter((span) => !spanHasErrors(span) && span !== functionEndSpan);

  const orderedSpans = [...errorSpans, ...normalSpans];

  let totalSize = getJSONBase64Size(resultSpans) + getJSONBase64Size(functionEndSpan);

  for (let span of orderedSpans) {
    let spanSize = getJSONBase64Size(span);
    if (totalSize + spanSize <= maxSendBytes) {
      resultSpans.push(span);
      totalSize += spanSize;
    } else {
      break;
    }
  }
  resultSpans.push(functionEndSpan);

  const scrubedSpans = resultSpans.map((span) => {
    if (span.info && span.info.httpInfo) {
      const { request, response } = span.info?.httpInfo;
      const isError = spanHasErrors(span);
      const sizeLimit = getEventEntitySize(isError);
      if (span.info.httpInfo.response.body) {
        span.info.httpInfo.response.body = scrub(response.body, response.headers, sizeLimit);
      }
      if (span.info.httpInfo.request.body) {
        span.info.httpInfo.request.body = scrub(
          decodeHttpBody(request.body, isError),
          request.headers,
          sizeLimit
        );
      }
      span.info.httpInfo.request.headers = payloadStringify(request.headers, sizeLimit);
      if (response.headers)
        span.info.httpInfo.response.headers = payloadStringify(response.headers, sizeLimit);
    }
    return span;
  });
  if (spans.length - scrubedSpans.length > 0) {
    logger.debug(`Trimmed spans due to size`);
  }
  logger.debug(
    `Filtered [${spans.length - resultSpans.length}] spans out, Scrubbed: [${
      scrubedSpans.length
    }], Took: [${new Date().getTime() - start}ms]`
  );
  return scrubedSpans.length > 0 ? JSON.stringify(scrubedSpans) : undefined;
};
