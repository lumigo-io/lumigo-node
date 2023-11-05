import { payloadStringify } from '../utils/payloadStringify';
import { FETCH_SPAN, getBasicChildSpan } from './awsSpan';

export const createFetchSpan = (
  transactionId,
  awsRequestId,
  spanId,
  requestMetadata,
  fetchFields
) => {
  const baseSpan = getBasicChildSpan(transactionId, awsRequestId, spanId, FETCH_SPAN);
  const { command = null, args = null } = fetchFields.command || {};
  return {
    ...baseSpan,
    started: requestMetadata.started,
    requestCommand: command,
    requestArgs: args ? payloadStringify(args) : args,
  };
};

export const extendRedisSpan = (currentSpan, extendData) => {
  // This function is not pure for ensure performance
  if (extendData.result) {
    currentSpan.response = payloadStringify(extendData.result);
  }
  if (extendData.error) {
    currentSpan.error = payloadStringify(extendData.error);
  }
  currentSpan.ended = extendData.ended;
  return currentSpan;
};
