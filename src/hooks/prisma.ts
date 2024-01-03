import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';
import { getCurrentTransactionId } from '../spans/awsSpan';
import { createPrismaSpan, extendedPrismaSpan } from '../spans/prismaSpan';
import { getRandomId, safeExecute } from '../utils';
import { safeRequire } from '../utils/requireUtils';

async function queryExtension({ query, args, model, operation }) {
  logger.debug('running queryExtension', { query, args, model, operation });

  const awsRequestId: string = TracerGlobals.getHandlerInputs().context.awsRequestId;
  const transactionId: string = getCurrentTransactionId();
  const spanId: string = getRandomId();
  const prismaSpan = createPrismaSpan(
    transactionId,
    awsRequestId,
    spanId,
    {
      started: Date.now(),
    },
    {
      model,
      operation,
      queryArgs: args,
    }
  );
  SpansContainer.addSpan(prismaSpan);

  try {
    const result = await query(args);
    const extendedSpan = extendedPrismaSpan(prismaSpan, { result, ended: Date.now() });

    logger.debug('PrismaClient returned result', { extendedSpan });

    SpansContainer.addSpan(extendedSpan);

    return result;
  } catch (error) {
    const extendedSpan = extendedPrismaSpan(prismaSpan, {
      error,
      ended: Date.now(),
    });
    SpansContainer.addSpan(extendedSpan);

    logger.debug('PrismaClient threw an error', { extendedSpan });

    throw error;
  }
}

export const hookPrisma = (prismaClientLibrary: unknown | null = null, requireFn = safeRequire) => {
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
