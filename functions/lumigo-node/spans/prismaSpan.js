import { payloadStringify } from '../utils/payloadStringify';
import { PRISMA_SPAN, getBasicChildSpan } from './awsSpan';
export const createPrismaSpan = (transactionId, awsRequestId, spanId, requestMetadata, prismaFields) => {
    const baseSpan = getBasicChildSpan(transactionId, awsRequestId, spanId, PRISMA_SPAN);
    return Object.assign(Object.assign({}, baseSpan), { started: requestMetadata.started, model: prismaFields.model, operation: prismaFields.operation, queryArgs: payloadStringify(prismaFields.queryArgs) });
};
export const extendedPrismaSpan = (prismaSpan, extendedFields) => {
    if (extendedFields.error) {
        prismaSpan.error = payloadStringify(extendedFields.error);
    }
    if (extendedFields.result !== undefined) {
        prismaSpan.result = payloadStringify(extendedFields.result);
    }
    if (extendedFields.ended) {
        prismaSpan.ended = extendedFields.ended;
    }
    return prismaSpan;
};
