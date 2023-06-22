import { getRandomString } from '../utils';
import { getCurrentTransactionId } from '../spans/awsSpan';
import * as logger from '../logger';

export const TRACEPARENT_HEADER_NAME = 'traceparent';
export const TRACESTATE_HEADER_NAME = 'tracestate';
export const SKIP_INJECT_HEADERS = ['x-amz-content-sha256'];
// The regex was copied from:
// https://github.com/open-telemetry/opentelemetry-python/blob/cad776a2031c84fb3c3a1af90ee2a939f3394b9a/opentelemetry-api/src/opentelemetry/trace/propagation/tracecontext.py#L28
const TRACEPARENT_HEADER_FORMAT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})/;
const MALFORMED_TRACE_ID = '0'.repeat(32);
const MALFORMED_SPAN_ID = '0'.repeat(16);

const generateMessageId = (): string => getRandomString(16);

export const shouldSkipTracePropagation = (headers: Record<string, string>): boolean => {
  return Object.keys(headers).some((key) => SKIP_INJECT_HEADERS.includes(key.toLowerCase()));
};

export const addW3CTracePropagator = (headers: Record<string, string>): Record<string, string> => {
  if (shouldSkipTracePropagation(headers)) {
    logger.debug('Skipping trace propagation');
    return headers;
  }
  const messageId = generateMessageId();
  headers[TRACEPARENT_HEADER_NAME] = getTraceId(headers, getCurrentTransactionId(), messageId);
  headers[TRACESTATE_HEADER_NAME] = getTraceState(headers, messageId);
  return headers;
};

const parseW3CHeader = (headers: Record<string, string>) => {
  const existingHeader = headers?.[TRACEPARENT_HEADER_NAME] || '';
  const match = TRACEPARENT_HEADER_FORMAT.exec(existingHeader);
  if (match) {
    return {
      version: match[1],
      traceId: match[2],
      spanId: match[3],
      traceFlags: match[4],
    };
  }
  return {};
};

const getTraceId = (
  headers: Record<string, string>,
  transactionId: string,
  messageID: string
): string => {
  // Create the TraceId: either by continuing the transaction that we already see from the headers,
  //   or by creating a new transaction. The spanId is this span (the next component's parent).
  let { version, traceId, spanId, traceFlags } = parseW3CHeader(headers);
  if (
    !version ||
    traceId === MALFORMED_TRACE_ID ||
    spanId == MALFORMED_SPAN_ID ||
    version == 'ff'
  ) {
    version = '00';
    traceId = transactionId.padEnd(32, '0');
    traceFlags = '01';
  }
  return `${version}-${traceId}-${messageID}-${traceFlags}`;
};

const getTraceState = (headers: Record<string, string>, messageID: string): string => {
  const lumigoState = `lumigo=${messageID}`;
  if (headers?.[TRACESTATE_HEADER_NAME]) {
    return headers[TRACESTATE_HEADER_NAME] + ',' + lumigoState;
  }
  return lumigoState;
};

export const getW3CMessageId = (headers: Record<string, string>): string | null => {
  try {
    return parseW3CHeader(headers).spanId;
  } catch (e) {
    logger.debug('Unable to parse W3C header, '.concat(e));
    return undefined;
  }
};
