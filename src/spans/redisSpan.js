import { getBasicChildSpan, REDIS_SPAN } from './awsSpan';
import { payloadStringify } from '../utils/payloadStringify';

export const createRedisSpan = (spanId, requestMetadata, redisFields) => {
  const baseSpan = getBasicChildSpan(spanId, REDIS_SPAN);
  const { command = null, args = null } = redisFields.command || {};
  return {
    ...baseSpan,
    started: requestMetadata.started,
    requestCommand: command,
    requestArgs: args ? payloadStringify(args) : args,
    connectionOptions: redisFields.connectionOptions,
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
