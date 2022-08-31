import { getRandomString } from '../utils';
import { getCurrentTransactionId } from '../spans/awsSpan';

// parts of this file were copied from:
// https://github.com/open-telemetry/opentelemetry-python/blob/cad776a2031c84fb3c3a1af90ee2a939f3394b9a/opentelemetry-api/src/opentelemetry/trace/propagation/tracecontext.py#L28
export const TRACEPARENT_HEADER_NAME = 'traceparent';
export const TRACESTATE_HEADER_NAME = 'tracestate';
const TRACEPARENT_HEADER_FORMAT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})/g;
const MALFORMED_TRACE_ID = '0'.repeat(32);
const MALFORMED_SPAN_ID = '0'.repeat(16);

const generateMessageId = (): string => getRandomString(16);

export const addW3CTracePropagator = (headers: Record<string, string>): Record<string, string> => {
  const messageId = generateMessageId();
  headers[TRACEPARENT_HEADER_NAME] = getTraceId(headers, getCurrentTransactionId(), messageId);
  headers[TRACESTATE_HEADER_NAME] = getTraceState(headers, messageId);
  return headers;
};

const getTraceId = (
  headers: Record<string, string>,
  transactionId: string,
  messageID: string
): string => {
  let version = null;
  let trace_id = null;
  let span_id = null;
  let trace_flags = null;
  const existingHeader = headers?.[TRACEPARENT_HEADER_NAME] || '';
  const match = TRACEPARENT_HEADER_FORMAT.exec(existingHeader);
  if (match) {
    version = match[1];
    trace_id = match[2];
    span_id = match[3];
    trace_flags = match[4];
  }
  if (
    !match ||
    trace_id === MALFORMED_TRACE_ID ||
    span_id == MALFORMED_SPAN_ID ||
    version == 'ff'
  ) {
    version = '00';
    trace_id = transactionId.padEnd(32, '0');
    trace_flags = '01';
  }
  span_id = messageID;
  return `${version}-${trace_id}-${span_id}-${trace_flags}`;
};

const getTraceState = (headers: Record<string, string>, messageID: string): string => {
  const lumigoState = `lumigo=${messageID}`;
  if (headers?.[TRACESTATE_HEADER_NAME]) {
    return headers[TRACESTATE_HEADER_NAME] + ',' + lumigoState;
  }
  return lumigoState;
};

export const isW3CHeaders = (headers: Record<string, string>): boolean =>
  !!TRACEPARENT_HEADER_FORMAT.exec(headers?.[TRACEPARENT_HEADER_NAME] || '');

export const getW3CMessageId = (headers: Record<string, string>): string | null => {
  const match = TRACEPARENT_HEADER_FORMAT.exec(headers?.[TRACEPARENT_HEADER_NAME] || '');
  if (match) {
    return match[3];
  }
  return null;
};
