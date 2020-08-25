import { getBasicChildSpan, PG_SPAN } from './awsSpan';

export const createPgSpan = (spanId, requestMetadata, pgFields) => {
  const baseSpan = getBasicChildSpan(spanId, PG_SPAN);
  return {
    ...baseSpan,
    started: requestMetadata.started,
    connectionParameters: {
      host: pgFields.connectionParameters.host,
      port: pgFields.connectionParameters.port,
      database: pgFields.connectionParameters.database,
      user: pgFields.connectionParameters.user,
    },
    query: pgFields.query,
  };
};

export const extendPgSpan = (currentSpan, extendData) => {
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
