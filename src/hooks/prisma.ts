import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';
import { getCurrentTransactionId } from '../spans/awsSpan';
import { createPrismaSpan, extendedPrismaSpan } from '../spans/prismaSpan';
import { getRandomId } from '../utils';
import { safeRequire } from '../utils/requireUtils';

async function queryExtension({ query, args, model, operation }) {
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
    SpansContainer.addSpan(extendedSpan);

    return result;
  } catch (error) {
    const extendedSpan = extendedPrismaSpan(prismaSpan, {
      error,
      ended: Date.now(),
    });
    SpansContainer.addSpan(extendedSpan);
    throw error;
  }
}

export const hookPrisma = (prismaClientLibrary: unknown | null = null) => {
  const prismaLib = prismaClientLibrary ? prismaClientLibrary : safeRequire('@prisma/client');

  if (!prismaLib) {
    logger.debug('Prisma client not found, skipping hook');
    return;
  }

  const OriginalConstructor = prismaLib.PrismaClient;

  if (!OriginalConstructor) {
    logger.debug('PrismaClient class not found, skipping hook');
    return;
  }

  prismaLib.PrismaClient = function (...args) {
    const originalInstance = new OriginalConstructor(...args);

    if (typeof originalInstance.$extends !== 'function') {
      return originalInstance;
    }

    return originalInstance.$extends({
      query: {
        $allOperations: queryExtension,
      },
    });
  };
};
