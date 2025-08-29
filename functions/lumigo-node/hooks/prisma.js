var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';
import { getCurrentTransactionId } from '../spans/awsSpan';
import { createPrismaSpan, extendedPrismaSpan } from '../spans/prismaSpan';
import { getRandomId, safeExecute } from '../utils';
import { safeRequire } from '../utils/requireUtils';
function queryExtension(_a) {
    return __awaiter(this, arguments, void 0, function* ({ query, args, model, operation }) {
        logger.debug('running queryExtension', { query, args, model, operation });
        const awsRequestId = TracerGlobals.getHandlerInputs().context.awsRequestId;
        const transactionId = getCurrentTransactionId();
        const spanId = getRandomId();
        const prismaSpan = createPrismaSpan(transactionId, awsRequestId, spanId, {
            started: Date.now(),
        }, {
            model,
            operation,
            queryArgs: args,
        });
        SpansContainer.addSpan(prismaSpan);
        try {
            const result = yield query(args);
            const extendedSpan = extendedPrismaSpan(prismaSpan, { result, ended: Date.now() });
            logger.debug('PrismaClient returned result', { extendedSpan });
            SpansContainer.addSpan(extendedSpan);
            return result;
        }
        catch (error) {
            const extendedSpan = extendedPrismaSpan(prismaSpan, {
                error,
                ended: Date.now(),
            });
            SpansContainer.addSpan(extendedSpan);
            logger.debug('PrismaClient threw an error', { extendedSpan });
            throw error;
        }
    });
}
export const hookPrisma = (prismaClientLibrary = null, requireFn = safeRequire) => {
    const prismaLib = prismaClientLibrary ? prismaClientLibrary : requireFn('@prisma/client');
    if (!prismaLib) {
        logger.debug('@prisma/client not found, skipping hook');
        return;
    }
    logger.debug('Hooking PrismaClient');
    const OriginalConstructor = prismaLib.PrismaClient;
    if (!OriginalConstructor) {
        logger.debug('PrismaClient class not found, skipping hook');
        return;
    }
    prismaLib.PrismaClient = function (...args) {
        const clientInstance = new OriginalConstructor(...args);
        return safeExecute(() => {
            if (typeof clientInstance.$extends !== 'function') {
                return clientInstance;
            }
            logger.debug('PrismaClient.$extends found, extending');
            return clientInstance.$extends({
                query: {
                    $allOperations: queryExtension,
                },
            });
        }, clientInstance)();
    };
};
