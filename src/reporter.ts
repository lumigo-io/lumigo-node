import {
  getEventEntitySize,
  getJSONBase64Size,
  getMaxRequestSize,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  isString,
  shouldScrubDomain,
  spanHasErrors,
} from './utils';
import * as logger from './logger';
import { HttpSpansAgent } from './httpSpansAgent';
import { payloadStringify } from './utils/payloadStringify';
import { decodeHttpBody } from './spans/awsSpan';
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

export const sendSpans = async (spans: any[]): Promise<void> => {
  if (isSendOnlyIfErrors() && !isSpansContainsErrors(spans)) {
    logger.debug('No Spans was sent, `SEND_ONLY_IF_ERROR` is on and no span has error');
    return;
  }
  const reqBody = forgeAndScrubRequestBody(spans, getMaxRequestSize());

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

function scrub(payload: any, headers: any, sizeLimit: number, truncated = false): string {
  try {
    if (isJsonContent(payload, headers)) {
      if (truncated) payload = untruncateJson(payload);
      return payloadStringify(JSON.parse(payload), sizeLimit);
    } else {
      return payloadStringify(payload, sizeLimit);
    }
  } catch (e) {
    return payloadStringify(payload, sizeLimit);
  }
}

function scrubSpans(resultSpans: any[]) {
  resultSpans.forEach((span) => {
    if (span.info?.httpInfo) {
      const { request, response, host } = span.info.httpInfo;
      if (
        shouldScrubDomain(host) ||
        (request.host && shouldScrubDomain(request.host)) ||
        (response.host && shouldScrubDomain(response.host))
      ) {
        request.body = 'The data is not available';
        response.body = 'The data is not available';
        delete request.headers;
        delete response.headers;
        delete request.uri;
      } else {
        const isError = spanHasErrors(span);
        const sizeLimit = getEventEntitySize(isError);
        if (span.info.httpInfo.response.body) {
          span.info.httpInfo.response.body = scrub(
            decodeHttpBody(response.body, isError),
            response.headers,
            sizeLimit,
            span.info.httpInfo.response.truncated
          );
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
    }
  });
}

// We muted the spans itself to keep the memory footprint of the tracer to a minimum
export const forgeAndScrubRequestBody = (spans, maxSendBytes): string | undefined => {
  const start = new Date().getTime();
  const originalSize = spans.length;
  if (!isPruneTraceOff() && shouldTrim(spans, maxSendBytes)) {
    logger.debug(
      `Starting trim spans [${spans.length}] bigger than: [${maxSendBytes}] before send`
    );

    const functionEndSpan = spans.pop();
    spans.sort((a, b) => (spanHasErrors(a) ? -1 : spanHasErrors(b) ? 1 : 0));
    let totalSize = getJSONBase64Size(functionEndSpan) + getJSONBase64Size(spans);
    while (totalSize > maxSendBytes && spans.length > 0)
      totalSize -= getJSONBase64Size(spans.pop());
    spans.push(functionEndSpan);
  }
  scrubSpans(spans);
  if (originalSize - spans.length > 0) {
    logger.debug(`Trimmed spans due to size`);
  }
  logger.debug(
    `Filtered [${spans.length - spans.length}] spans out, Took: [${new Date().getTime() - start}ms]`
  );
  return spans.length > 0 ? JSON.stringify(spans) : undefined;
};
