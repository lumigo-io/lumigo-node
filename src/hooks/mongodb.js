import { safeRequire } from '../utils/requireUtils';
import { getRandomId, safeExecute } from '../utils';
import { createMongoDbSpan, extendMongoDbSpan } from '../spans/mongoDbSpan';
import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';
import { getCurrentTransactionId } from '../spans/awsSpan';

const PendingRequests = (() => {
  let pendingRequests = {};

  const addPendingRequest = (requestId, spanId) => {
    pendingRequests[requestId] = spanId;
  };

  const popPendingRequestSpanId = (requestId) => {
    const spanId = pendingRequests[requestId];
    delete pendingRequests[requestId];
    return spanId;
  };

  return {
    addPendingRequest,
    popPendingRequestSpanId,
  };
})();

const onStartedHook = (event) => {
  const awsRequestId = TracerGlobals.getHandlerInputs().context.awsRequestId;
  const transactionId = getCurrentTransactionId();
  const { command, databaseName, commandName, requestId, operationId, connectionId } = event;
  const started = Date.now();
  const spanId = getRandomId();
  PendingRequests.addPendingRequest(requestId, spanId);
  const mongoSpan = createMongoDbSpan(
    transactionId,
    awsRequestId,
    spanId,
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

const onSucceededHook = (event) => {
  const { duration, reply, requestId } = event;
  const currentSpanId = PendingRequests.popPendingRequestSpanId(requestId);
  const currentSpan = SpansContainer.getSpanById(currentSpanId);
  const extendedMondoDbSpan = extendMongoDbSpan(currentSpan, {
    duration,
    reply,
  });
  SpansContainer.addSpan(extendedMondoDbSpan);
};

const onFailedHook = (event) => {
  const { duration, failure, requestId } = event;
  const currentSpanId = PendingRequests.popPendingRequestSpanId(requestId);
  const currentSpan = SpansContainer.getSpanById(currentSpanId);
  const extendedMondoDbSpan = extendMongoDbSpan(currentSpan, {
    duration,
    failure,
  });
  SpansContainer.addSpan(extendedMondoDbSpan);
};

export const hookMongoDb = (mongoLib) => {
  const mongoClient = mongoLib ? mongoLib : safeRequire('mongodb');
  const mongoosClients = safeRequire('node_modules/mongoose/node_modules/mongodb');
  const mongoClients = [mongoClient, mongoosClients].filter(Boolean);
  if (mongoClients.length > 0) {
    mongoClients.forEach((mongoClient) => {
      logger.info('Starting to instrument MongoDB');
      const listener = mongoClient.instrument({}, (err) => {
        if (err) logger.warn('MongoDB instrumentation failed ', err);
      });
      const safeStartedHook = safeExecute(onStartedHook);
      const safeSucceededHook = safeExecute(onSucceededHook);
      const safeFailedHook = safeExecute(onFailedHook);
      safeExecute(() => {
        listener.on('started', safeStartedHook);
        listener.on('succeeded', safeSucceededHook);
        listener.on('failed', safeFailedHook);
      })();
    });
    logger.info('MongoDB instrumentation done');
  } else {
    logger.debug('MongoDB SDK not found');
  }
};
