import {
  EXECUTION_TAGS_KEY,
  getEventEntitySize,
  getJSONBase64Size,
  getMaxRequestSize,
  getMaxRequestSizeOnError,
  getRandomId,
  INVOCATION_ID_KEY,
  isPruneTraceOff,
  isSendOnlyIfErrors,
  isString,
  safeExecute,
  SENDING_TIME_ID_KEY,
  shouldScrubDomain,
  shouldTryZip,
  spanHasErrors,
  TRANSACTION_ID_KEY,
} from './utils';
import * as logger from './logger';
import { HttpSpansAgent } from './httpSpansAgent';
import { payloadStringify } from './utils/payloadStringify';
import {
  decodeHttpBody,
  ENRICHMENT_SPAN,
  getCurrentTransactionId,
  getSpanMetadata,
  spansPrioritySorter,
} from './spans/awsSpan';
import untruncateJson from './tools/untrancateJson';
import { gzipSync } from 'zlib';
import { DroppedSpanReasons, ExecutionTags, SpansContainer, TracerGlobals } from './globals';
import { GenericSpan } from './types/spans/basicSpan';

export const NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION = 200;
export const MAX_SPANS_BULK_SIZE = 200;

const MAX_SEND_ENRICHMENT_SPAN_BUFFER = 200;

export const sendSingleSpan = async (span: GenericSpan, addEnrichmentSpan: boolean = false) =>
  sendSpans([span], addEnrichmentSpan);

export const logSpans = (rtt: number, spans): void => {
  const spanIds = spans.map((span) => span.id);
  logger.debug(`Spans sent [${rtt}ms, ${spanIds.length} spans]`, spanIds);
};

export const isSpansContainsErrors = (spans): boolean => {
  const safeGetStatusCode = (s) => (s['returnValue'] || {})['statusCode'] || 0;
  const spanHasError = (s) => s.error !== undefined || safeGetStatusCode(s) > 400;
  return spans.filter(spanHasError).length > 0;
};

export const sendSpans = async (spans: any[], addEnrichmentSpan: boolean = true): Promise<void> => {
  if (isSendOnlyIfErrors() && !isSpansContainsErrors(spans)) {
    logger.debug('No Spans was sent, `SEND_ONLY_IF_ERROR` is on and no span has error');
    return;
  }
  const reqBody = safeExecute(forgeAndScrubRequestBody)(
    spans,
    getMaxRequestSize(),
    getMaxRequestSizeOnError(),
    shouldTryZip(),
    addEnrichmentSpan
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
  const isJsonString = (str: any) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };
  const isJsonObjectOrArray = (str: string) => {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  };

  return (
    isString(payload) &&
    (headers['content-type']?.toLowerCase().includes('json') ||
      (isJsonObjectOrArray(payload) && isJsonString(payload)))
  );
};

function scrub(payload: any, headers: any, sizeLimit: number, truncated = false, contextKey?: string): string {
  try {
    if (isJsonContent(payload, headers)) {
      if (truncated) payload = untruncateJson(payload);
      return payloadStringify(JSON.parse(payload), sizeLimit, null, truncated, contextKey);
    } else {
      return payloadStringify(payload, sizeLimit, null, truncated, contextKey);
    }
  } catch (e) {
    return payloadStringify(payload, sizeLimit, null, truncated, contextKey);
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
          span.info.httpInfo.response.truncated,
          'responseBody'
        );
      }
      if (span.info.httpInfo.request?.body) {
        span.info.httpInfo.request.body = scrub(
          decodeHttpBody(request.body, isError),
          request.headers,
          sizeLimit,
          span.info.httpInfo.request.truncated,
          'requestBody'
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
  const spansToSend: { [id: string]: GenericSpan } = {};

  const sendEnrichmentSpanSizeBuffer = spans.find((span) => span.type === ENRICHMENT_SPAN)
    ? 0
    : MAX_SEND_ENRICHMENT_SPAN_BUFFER;

  let enrichmentSpansDropped = false;

  // First we try to take only the spans metadata
  for (let index = 0; index < spans.length; index++) {
    const spanMetadata = getSpanMetadata(spans[index]);
    spansToSendSizes[index] = 0;
    if (spanMetadata === undefined) continue;
    const spanMetadataSize = getJSONBase64Size(spanMetadata);

    if (currentSize + spanMetadataSize < maxSendBytes - sendEnrichmentSpanSizeBuffer) {
      spansToSendSizes[index] = spanMetadataSize;
      spansToSend[index] = spanMetadata;
      currentSize += spanMetadataSize;
    } else if (spans[index].type === ENRICHMENT_SPAN) {
      enrichmentSpansDropped = true;
    }
  }

  // Replace metadata span with full spans
  for (let index = 0; index < spans.length; index++) {
    const spanSize = getJSONBase64Size(spans[index]);
    const spanMetadataSize = spansToSendSizes[index];

    if (currentSize + spanSize - spanMetadataSize < maxSendBytes - sendEnrichmentSpanSizeBuffer) {
      spansToSend[index] = spans[index];
      currentSize += spanSize - spanMetadataSize;
    }
  }

  let finalSpansToSend = Object.values(spansToSend);
  const spansDropped = spans.length - finalSpansToSend.length;
  if (spansDropped > 0) {
    logger.info(`Dropped ${spansDropped} spans due to size limit of total spans sent to lumigo`);

    // If we are not adding an enrichment span then no need to record these dropped spans, they might be re-sent in a later stage in the invocation
    SpansContainer.recordDroppedSpan(DroppedSpanReasons.SPANS_SENT_SIZE_LIMIT, false, spansDropped);
    if (!enrichmentSpansDropped) {
      finalSpansToSend = addOrUpdateEnrichmentSpan(finalSpansToSend);
    } else {
      logger.warn(
        'Enrichment span was dropped due to size limit of total spans sent to lumigo, so dropped spans counts might be missing'
      );
    }
  }

  return finalSpansToSend;
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

/**
 * Add or create an enrichment span to the given list of spans, with overall span count information.
 * @param {GenericSpan[]} spans List of spans to add to
 * @returns {GenericSpan[]} The given list, with an enrichment span added / modified with the span counts
 */
export const addOrUpdateEnrichmentSpan = (spans: GenericSpan[]): GenericSpan[] => {
  let enrichmentSpan = spans.find((span) => span.type === ENRICHMENT_SPAN);

  const spansEnrichmentData = {
    id: enrichmentSpan ? enrichmentSpan.id : getRandomId(),
    droppedSpansReasons: SpansContainer.getDroppedSpansReasons(),
    totalSpans: SpansContainer.getTotalSpans(),
    token: TracerGlobals.getTracerInputs().token,
    [TRANSACTION_ID_KEY]: getCurrentTransactionId(),
    [INVOCATION_ID_KEY]: TracerGlobals.getHandlerInputs()?.context?.awsRequestId,
    [EXECUTION_TAGS_KEY]: ExecutionTags.getTags(),
    [SENDING_TIME_ID_KEY]: new Date().getTime(),
  };

  if (enrichmentSpan) {
    Object.assign(enrichmentSpan, spansEnrichmentData);
    SpansContainer.addSpan(enrichmentSpan, true);
    logger.debug('Enrichment span updated with the latest data', enrichmentSpan);
  } else {
    enrichmentSpan = {
      type: ENRICHMENT_SPAN,
      ...spansEnrichmentData,
    };
    SpansContainer.addSpan(enrichmentSpan, true);
    enrichmentSpan.totalSpans = SpansContainer.getTotalSpans();
    spans.push({
      type: ENRICHMENT_SPAN,
      ...enrichmentSpan,
    });
    logger.debug('Enrichment span created', enrichmentSpan);
  }

  return spans;
};

// We muted the spans itself to keep the memory footprint of the tracer to a minimum
export const forgeAndScrubRequestBody = (
  spans: any[],
  maxSendBytes: number,
  maxSendBytesOnError: number,
  shouldTryZip: boolean = false,
  addEnrichmentSpan: boolean = true
): string | string[] | undefined => {
  const maxRequestSize = spans.some(spanHasErrors) ? maxSendBytesOnError : maxSendBytes;
  const start = new Date().getTime();

  if (addEnrichmentSpan) {
    // If there were span drops, find an enrichment span or create one and add the dropped spans info to the enrichment span
    spans = addOrUpdateEnrichmentSpan(spans);
  }

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
        `Spans are too big, size [${size}], [${spans.length}] spans, bigger than: [${maxRequestSize}], trying to split and zip`
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
