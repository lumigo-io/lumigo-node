import { hook } from '../extender';
import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';
import { getCurrentTransactionId } from '../spans/awsSpan';
import { createMongoDbSpan, extendMongoDbSpan } from '../spans/mongoDbSpan';
import { getRandomId, safeExecute } from '../utils';
import { safeRequire } from '../utils/requireUtils';

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

function mongoClient4xBeforeConstructorHook(args, extenderContext) {
  /*
   * Inject the `monitorCommands: true` property in the options (2nd argument).
   * If no options argument is given, well... now there is :D
   */
  switch (args.length) {
    case 0:
      /*
       * Wait this is not possible. It is supposed to have at least the URL
       * as first arg!
       */
      logger.debug('MongoDB 4.x instrumentation skipped: unexpected zero arguments to MongoClient constructor');
      break;
    case 1:
      args.push({
        monitorCommands: true,
      });
      break;
    default:
      switch (typeof args[1]) {
        case 'object':
          // TODO Check for `null`, which has type object?
          args[1].monitorCommands = true;
          break;
        case 'undefined':
          args[1] = {
            monitorCommands: true,
          };
          break;
        default:
          logger.debug(`MongoDB 4.x instrumentation skipped: unexpected type of the 'options' argument: ${typeof optionsObject}`);
      }
  }
}

function mongoClient4xAfterConstructorHook(args, clientInstance, extenderContext) {
  /*
   * Turn on the command listener. This assumes the `monitorCommands` flag we
   * add in the 'beforeConstructor' hook. The shape of the events we get from
   * the MongoDB Client 4.x is the same as those that 3.x emitted with 'instrument'.
   */
  if (args.length > 1 && (typeof args[1]) === 'object' && args[1].monitorCommands === true) {
    try {
      clientInstance.on('commandStarted', safeExecute(onStartedHook));
      clientInstance.on('commandSucceeded', safeExecute(onSucceededHook));
      clientInstance.on('commandFailed', safeExecute(onFailedHook));
    } catch (err) {
      logger.debug(`MongoDB 4.x 'on' hooks cannot be applied to ${clientInstance}`, err);
    }
  } else {
    logger.debug("MongoDB 4.x 'on' hooks skipped: monitorCommands was not set in the options");
  }
}

export const hookMongoDb = (mongoLib) => {
  const mongoClient = mongoLib ? mongoLib : safeRequire('mongodb');
  const mongooseClients = safeRequire('node_modules/mongoose/node_modules/mongodb');
  const mongoClients = [mongoClient, mongooseClients].filter(Boolean);

  if (!mongoClients) {
    logger.debug('MongoDB not found');
    return;
  }

  mongoClients.forEach((mongoLib) => {
    if (mongoLib.instrument) {
      // MongoDB 3.x
      const listener = mongoLib.instrument({}, (err) => {
        if (err) logger.warn('MongoDB 3.x instrumentation failed ', err);
      });

      const safeStartedHook = safeExecute(onStartedHook);
      const safeSucceededHook = safeExecute(onSucceededHook);
      const safeFailedHook = safeExecute(onFailedHook);

      safeExecute(() => {
        listener.on('started', safeStartedHook);
        listener.on('succeeded', safeSucceededHook);
        listener.on('failed', safeFailedHook);
      })();

      logger.debug('MongoDB 3.x instrumentation applied');
    } else if (mongoLib.MongoClient.prototype.on) {
      logger.debug({
        beforeHook: mongoClient4xBeforeConstructorHook,
        afterHook: mongoClient4xAfterConstructorHook,
      });
      hook(mongoLib, 'MongoClient', {
        beforeHook: mongoClient4xBeforeConstructorHook,
        afterHook: mongoClient4xAfterConstructorHook,
      });

      // TODO Find a hook for catching connection issues.

      logger.debug('MongoDB 4.x instrumentation applied');
    }
  });
};
