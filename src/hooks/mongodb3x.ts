import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';
import { getCurrentTransactionId } from '../spans/awsSpan';
import { createMongoDbSpan, extendMongoDbSpan } from '../spans/mongoDbSpan';
import { getRandomId, safeExecute } from '../utils';

const requestIdLookup = {};

export const onStartedHook = (event: any) => {
  const awsRequestId: string = TracerGlobals.getHandlerInputs().context.awsRequestId;
  const transactionId: string = getCurrentTransactionId();
  const { command, databaseName, commandName, requestId, operationId, connectionId } = event;
  const started: number = Date.now();
  const randomRequestId = getRandomId();
  requestIdLookup[requestId] = randomRequestId;
  const mongoSpan = createMongoDbSpan(
    transactionId,
    awsRequestId,
    randomRequestId,
    {
      started,
    },
    {
      databaseName,
      commandName,
      command,
      mongoRequestId: requestId,
      mongoOperationId: operationId,
      mongoConnectionId: connectionId,
    }
  );
  SpansContainer.addSpan(mongoSpan);
};

export const onSucceededHook = (event: any) => {
  const { duration, reply, requestId } = event;
  const currentSpan = SpansContainer.getSpanById(requestIdLookup[requestId]);
  delete requestIdLookup[requestId];
  if (currentSpan) {
    const extendedMongoDbSpan = extendMongoDbSpan(currentSpan, {
      duration,
      reply,
    });
    SpansContainer.addSpan(extendedMongoDbSpan);
  }
};

export const onFailedHook = (event: any) => {
  const { duration, failure, requestId } = event;
  const currentSpan = SpansContainer.getSpanById(requestIdLookup[requestId]);
  delete requestIdLookup[requestId];
  if (currentSpan) {
    const extendedMongoDbSpan = extendMongoDbSpan(currentSpan, {
      duration,
      failure,
    });
    SpansContainer.addSpan(extendedMongoDbSpan);
  }
};

export const configureMongoClient3xInstrumentation = (mongoClientLibrary: any) => {
  const listener = mongoClientLibrary.instrument({}, (err: any) => {
    if (err) {
      logger.warn('MongoDB 3.x instrumentation failed ', err);
    }
  });

  const safeStartedHook: Function = safeExecute(onStartedHook);
  const safeSucceededHook: Function = safeExecute(onSucceededHook);
  const safeFailedHook: Function = safeExecute(onFailedHook);

  safeExecute(() => {
    listener.on('started', safeStartedHook);
    listener.on('succeeded', safeSucceededHook);
    listener.on('failed', safeFailedHook);
  })();
};
