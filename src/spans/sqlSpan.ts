import { getBasicChildSpan } from './awsSpan';
import { payloadStringify, prune } from '../utils/payloadStringify';
import { filterObjectKeys, getEventEntitySize } from '../utils';

const normalizeQuery = (query: string | any): string => {
  if (typeof query === 'string') return prune(query, getEventEntitySize());
  if (typeof query === 'object') {
    const filteredQuery = filterObjectKeys(query, (key) => !key.startsWith('_'));
    return payloadStringify(filteredQuery);
  }
  return "Unknown"
};

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
    query: normalizeQuery(dbFields.query),
    values: dbFields.values ? payloadStringify(dbFields.values) : '',
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
