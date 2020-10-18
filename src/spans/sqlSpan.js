import { getBasicChildSpan } from './awsSpan';
import { payloadStringify, prune } from '../utils/payloadStringify';
import { getEventEntitySize } from '../utils';

export const createSqlSpan = (
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
    connectionParameters: {
      host: dbFields.connectionParameters.host,
      port: dbFields.connectionParameters.port,
      database: dbFields.connectionParameters.database,
      user: dbFields.connectionParameters.user,
    },
    query: prune(dbFields.query, getEventEntitySize()),
    values: payloadStringify(dbFields.values),
  };
};

export const extendSqlSpan = (currentSpan, extendData) => {
  // This function is not pure for ensure performance
  if (extendData.result) {
    currentSpan.response = extendData.result;
  }
  if (extendData.error) {
    currentSpan.error = extendData.error;
  }
  currentSpan.ended = extendData.ended;
  return currentSpan;
};
