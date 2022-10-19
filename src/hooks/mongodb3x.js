import { SpansContainer, TracerGlobals } from '../globals';
import { getCurrentTransactionId } from '../spans/awsSpan';
import { createMongoDbSpan, extendMongoDbSpan } from '../spans/mongoDbSpan';
import { getRandomId } from '../utils';

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

export const onStartedHook = (event) => {
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

export const onSucceededHook = (event) => {
  const { duration, reply, requestId } = event;
  const currentSpanId = PendingRequests.popPendingRequestSpanId(requestId);
  const currentSpan = SpansContainer.getSpanById(currentSpanId);
  const extendedMondoDbSpan = extendMongoDbSpan(currentSpan, {
    duration,
    reply,
  });
  SpansContainer.addSpan(extendedMondoDbSpan);
};

export const onFailedHook = (event) => {
  const { duration, failure, requestId } = event;
  const currentSpanId = PendingRequests.popPendingRequestSpanId(requestId);
  const currentSpan = SpansContainer.getSpanById(currentSpanId);
  const extendedMondoDbSpan = extendMongoDbSpan(currentSpan, {
    duration,
    failure,
  });
  SpansContainer.addSpan(extendedMondoDbSpan);
};
