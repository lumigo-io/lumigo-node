import { safeRequire } from '../utils/requireUtils';
import { getRandomId, safeExecute } from '../utils';
import { createMongoDbSpan, extendMondoDbSpan } from '../spans/mongoDbSpan';
import { SpansContainer } from '../globals';
import * as logger from '../logger';

const PendingRequests = (() => {
  let pendingRequests = {};

  const addPendingRequest = (requestId, spanId) => {
    pendingRequests[requestId] = spanId;
  };

  const getPendingRequestSpanId = requestId => {
    const spanId = pendingRequests[requestId];
    delete pendingRequests[requestId];
    return spanId;
  };

  return {
    addPendingRequest,
    getPendingRequestSpanId,
  };
})();

const onStartedHook = event => {
  const { command, databaseName, commandName, requestId, operationId, connectionId } = event;
  const started = Date.now();
  const spanId = getRandomId();
  PendingRequests.addPendingRequest(requestId, spanId);
  const mongoSpan = createMongoDbSpan(
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

const onSucceededHook = event => {
  const { duration, reply, requestId } = event;
  const currentSpanId = PendingRequests.getPendingRequestSpanId(requestId);
  const currentSpan = SpansContainer.getSpanById(currentSpanId);
  const extendedMondoDbSpan = extendMondoDbSpan(currentSpan, {
    duration,
    reply,
  });
  SpansContainer.addSpan(extendedMondoDbSpan);
};

const onFailedHook = event => {
  const { duration, failure, requestId } = event;
  const currentSpanId = PendingRequests.getPendingRequestSpanId(requestId);
  const currentSpan = SpansContainer.getSpanById(currentSpanId);
  const extendedMondoDbSpan = extendMondoDbSpan(currentSpan, {
    duration,
    failure,
  });
  SpansContainer.addSpan(extendedMondoDbSpan);
};

export const hookMongoDb = mongoLib => {
  const mongoClient = mongoLib || safeRequire('mongodb');
  if (mongoClient) {
    logger.info('Starting to instrument MongoDB');
    const listener = mongoClient.instrument({}, err => {
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
  }
};
