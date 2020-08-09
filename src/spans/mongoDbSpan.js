import { getBasicChildSpan, MONGO_SPAN } from './awsSpan';
import { payloadStringify } from '../utils/payloadStringify';

export const createMongoDbSpan = (spanId, requestMetadata, mongoFields) => {
  const baseSpan = getBasicChildSpan(spanId, MONGO_SPAN);
  return {
    ...baseSpan,
    started: requestMetadata.started,
    databaseName: mongoFields.databaseName,
    commandName: mongoFields.commandName,
    mongoRequestId: mongoFields.mongoRequestId,
    mongoOperationId: mongoFields.mongoOperationId,
    mongoConnectionId: mongoFields.mongoConnectionId,
    request: payloadStringify(mongoFields.command),
  };
};

export const extendMongoDbSpan = (currentSpan, extendData) => {
  // This function is not pure for ensure performance
  if (extendData.reply) {
    currentSpan.response = payloadStringify(extendData.reply);
  }
  if (extendData.failure) {
    currentSpan.error = payloadStringify(extendData.failure);
  }
  currentSpan.ended = currentSpan.started + extendData.duration;
  return currentSpan;
};
