import { getEventEntitySize } from '../utils';
import { payloadStringify, truncate } from '../utils/payloadStringify';
import { getBasicChildSpan } from './awsSpan';

export const createNeo4jSpan = (
  transactionId,
  awsRequestId,
  spanId,
  requestMetadata,
  dbFields,
  spanType
) => {
  const baseSpan = getBasicChildSpan(transactionId, awsRequestId, spanId, spanType);
  return {
    ...baseSpan,
    started: requestMetadata.started,
    connectionParameters: dbFields.connectionParameters,
    query: truncate(dbFields.query, getEventEntitySize()),
    params: dbFields.params ? payloadStringify(dbFields.params) : null,
  };
};

export const extendNeo4jSpan = (currentSpan, extendData) => {
  // This function is not pure to ensure performance
  if (extendData.response) {
    currentSpan.response = extendData.response;
  }
  if (extendData.summary) {
    currentSpan.summary = extendData.summary;
  }
  if (extendData.database) {
    currentSpan.connectionParameters.database = extendData.database;
  }
  if (extendData.error) {
    currentSpan.error = extendData.error;
  }
  currentSpan.ended = extendData.ended;

  return currentSpan;
};
