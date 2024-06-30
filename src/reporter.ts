import {
  getEventEntitySize,
  getJSONBase64Size,
  getMaxRequestSize,
  getMaxRequestSizeOnError,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  isString,
  safeExecute,
  shouldScrubDomain,
  spanHasErrors,
  shouldTryZip,
} from './utils';
import * as logger from './logger';
import { HttpSpansAgent } from './httpSpansAgent';
import { payloadStringify } from './utils/payloadStringify';
import { decodeHttpBody, getSpanMetadata, spansPrioritySorter } from './spans/awsSpan';
import untruncateJson from './tools/untrancateJson';
import { gzipSync } from 'zlib';

export const NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION = 200;
export const MAX_SPANS_BULK_SIZE = 200;

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
  const reqBody = safeExecute(forgeAndScrubRequestBody)(
    spans,
    getMaxRequestSize(),
    getMaxRequestSizeOnError(),
    shouldTryZip()
  );

  const roundTripStart = Date.now();
  if (Array.isArray(reqBody)) {
    await Promise.all(reqBody.map((bulk) => HttpSpansAgent.postSpans(bulk)));
  } else if (reqBody) {
    await HttpSpansAgent.postSpans(reqBody);
  }
  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  safeExecute(logSpans)(rtt, spans);
};

const isJsonContent = (payload: any, headers: Object) => {
  return isString(payload) && headers['content-type'] && headers['content-type'].includes('json');
};

function scrub(payload: any, headers: any, sizeLimit: number, truncated = false): string {
  try {
    if (isJsonContent(payload, headers)) {
      if (truncated) payload = untruncateJson(payload);
      return payloadStringify(JSON.parse(payload), sizeLimit, null, truncated);
    } else {
      return payloadStringify(payload, sizeLimit, truncated);
    }
  } catch (e) {
    return payloadStringify(payload, sizeLimit, truncated);
  }
}

const scrubSpan = (span) => {
  if (span.info?.httpInfo) {
    const { request, response, host } = span.info.httpInfo;
    if (
      (response && request && shouldScrubDomain(host)) ||
      (request?.host && shouldScrubDomain(request.host)) ||
      (response?.host && shouldScrubDomain(response.host))
    ) {
      request.body = 'The data is not available';
      response.body = 'The data is not available';
      delete request.headers;
      delete response.headers;
      delete request.uri;
    } else {
      const isError = spanHasErrors(span);
      const sizeLimit = getEventEntitySize(isError);
      if (span.info.httpInfo.response?.body) {
        span.info.httpInfo.response.body = scrub(
          decodeHttpBody(response.body, isError),
          response.headers,
          sizeLimit,
          span.info.httpInfo.response.truncated
        );
      }
      if (span.info.httpInfo.request?.body) {
        span.info.httpInfo.request.body = scrub(
          decodeHttpBody(request.body, isError),
          request.headers,
          sizeLimit,
          span.info.httpInfo.request.truncated
        );
      }
      if (span.info.httpInfo.request?.headers) {
        span.info.httpInfo.request.headers = payloadStringify(request.headers, sizeLimit);
      }
      if (response?.headers)
        span.info.httpInfo.response.headers = payloadStringify(response.headers, sizeLimit);
    }
  }
  return span;
};

export function scrubSpans(resultSpans: any[]) {
  return resultSpans.filter((span) => safeExecute(scrubSpan, 'Failed to scrub span')(span));
}

export function getPrioritizedSpans(spans: any[], maxSendBytes: number): any[] {
  logger.debug('Using smart spans prioritization');
  spans.sort(spansPrioritySorter);
  let currentSize = 0;
  const spansToSendSizes = {};
  const spansToSend = {};

  // First we try to take only the spans metadata
  for (let index = 0; index < spans.length; index++) {
    const spanMetadata = getSpanMetadata(spans[index]);
    spansToSendSizes[index] = 0;
    if (spanMetadata === undefined) continue;
    const spanMetadataSize = getJSONBase64Size(spanMetadata);

    if (currentSize + spanMetadataSize < maxSendBytes) {
      spansToSendSizes[index] = spanMetadataSize;
      spansToSend[index] = spanMetadata;
      currentSize += spanMetadataSize;
    }
  }

  // Replace metadata span with full spans
  for (let index = 0; index < spans.length; index++) {
    const spanSize = getJSONBase64Size(spans[index]);
    const spanMetadataSize = spansToSendSizes[index];

    if (currentSize + spanSize - spanMetadataSize < maxSendBytes) {
      spansToSend[index] = spans[index];
      currentSize += spanSize - spanMetadataSize;
    }
  }

  return Object.values(spansToSend);
}

export function splitAndZipSpans(spans: any[]): string[] {
  logger.debug(`Splitting the spans to bulks of ${MAX_SPANS_BULK_SIZE} spans`);
  // Split the spans to bulks and zip each one
  const spansBulks: string[] = [];
  for (let i = 0; i < spans.length; i += MAX_SPANS_BULK_SIZE) {
    const bulk = spans.slice(i, i + MAX_SPANS_BULK_SIZE);
    const zippedSpans = gzipSync(JSON.stringify(bulk)).toString('base64');
    spansBulks.push(zippedSpans);
  }
  return spansBulks;
}

// We muted the spans itself to keep the memory footprint of the tracer to a minimum
export const forgeAndScrubRequestBody = (
  spans,
  maxSendBytes,
  maxSendBytesOnError,
  shouldTryZip: boolean = false
): string | string[] | undefined => {
  const maxRequestSize = spans.some(spanHasErrors) ? maxSendBytesOnError : maxSendBytes;
  const start = new Date().getTime();
  const beforeLength = spans.length;
  const originalSize = spans.length;
  const size = getJSONBase64Size(spans);
  if (spans.length == 0) {
    return undefined;
  }

  if (
    (!isPruneTraceOff() && spans.length > NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION) ||
    size > maxSendBytes
  ) {
    if (shouldTryZip) {
      logger.debug(
        `Spans are too big, size [${size}], bigger than: [${maxRequestSize}], trying to split and zip`
      );
      const zippedSpansBulks = splitAndZipSpans(spans);
      const areAllSpansSmallEnough = zippedSpansBulks.every(
        (zippedSpan) => getJSONBase64Size(zippedSpan) <= maxRequestSize
      );
      // If all the spans are small enough, return the bulks
      // Otherwise, continue to trim the spans
      if (areAllSpansSmallEnough) {
        logger.debug(`Created ${zippedSpansBulks.length} bulks of zipped spans`);
        return zippedSpansBulks;
      } else {
        logger.info(`Some of the zipped bulks are still too big, continuing to trim the spans`);
      }
    }
    logger.debug(
      `Starting trim spans [${spans.length}] bigger than: [${maxRequestSize}] before send`
    );
    spans = getPrioritizedSpans(spans, maxRequestSize);
  }
  spans = scrubSpans(spans);
  if (originalSize - spans.length > 0) {
    logger.debug(`Trimmed spans due to size`);
  }

  logger.debug(`Filtered [${beforeLength - spans.length}] spans out`);
  logger.debug(`Filtering and scrubbing, Took: [${new Date().getTime() - start}ms]`);
  return spans.length > 0 ? JSON.stringify(spans) : undefined;
};
