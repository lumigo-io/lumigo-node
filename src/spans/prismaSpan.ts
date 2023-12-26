import { payloadStringify } from '../utils/payloadStringify';
import { PRISMA_SPAN, getBasicChildSpan } from './awsSpan';
import { normalizeQuery } from './common';

export const createPrismaSpan = (
  transactionId,
  awsRequestId,
  spanId,
  requestMetadata,
  prismaFields
) => {
  const baseSpan = getBasicChildSpan(transactionId, awsRequestId, spanId, PRISMA_SPAN);
  return {
    ...baseSpan,
    started: requestMetadata.started,
    modelName: prismaFields.modelName,
    operation: prismaFields.operation,
    queryArgs: prismaFields.queryArgs ? payloadStringify(prismaFields.queryArgs) : '',
  };
};

export const extendedPrismaSpan = (prismaSpan, extendedFields) => {
  if (extendedFields.error) {
    prismaSpan.error = payloadStringify(extendedFields.error);
  }

  if (extendedFields.results) {
    prismaSpan.results = payloadStringify(extendedFields.results);
  }

  if (extendedFields.ended) {
    prismaSpan.ended = extendedFields.ended;
  }

  return prismaSpan;
};
