import { safeRequire } from '../utils/requireUtils';
import * as logger from '../logger';
import { hook, hookPromise } from '../extender';
import { getRandomId, isPromise } from '../utils';
import { SpansContainer, TracerGlobals } from '../globals';
import { createMongoDbSpan, extendMongoDbSpan } from '../spans/mongoDbSpan';
import { getCurrentTransactionId } from '../spans/awsSpan';

const mongooseQueries = [
  'remove',
  'deleteOne',
  'deleteMany',
  'find',
  'findOne',
  'estimatedDocumentCount',
  'countDocuments',
  'insertMany',
  'count',
  'save',
  'create',
  'distinct',
  'where',
  '$where',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndRemove',
];

const ActiveConnectionDetails = (() => {
  let _activeConnection = {};

  const getActiveConnection = () => _activeConnection;

  const updateFromConnectionString = (mssqlConnectionString) => {
    const uri = new URL(mssqlConnectionString);
    const database = uri.pathname.replace('/', '');
    _activeConnection = {
      user: uri.username,
      host: uri.hostname,
      port: uri.port,
      database: database,
    };
  };

  const updateFromConfig = (config) => {
    const database = config.database || config.server.split('.')[0];
    _activeConnection = {
      user: config.user,
      host: config.host || config.server,
      port: config.port,
      database: database,
    };
  };

  return {
    getActiveConnection,
    updateFromConnectionString,
    updateFromConfig,
  };
})();

function connectBeforeHook(args) {
  if (typeof args[0] === 'string') {
    ActiveConnectionDetails.updateFromConnectionString(args[0]);
  }
  if (this.config) {
    ActiveConnectionDetails.updateFromConfig(this.config);
  }
}

const handleResult = (currentSpan, result, error) => {
  const ended = Date.now();
  let extendData = { ended };
  if (error) {
    extendData.failure = error;
  } else {
    if (result) {
      extendData.reply = result;
      extendData.duration = ended - currentSpan.started;
    }
  }
  const span = extendMongoDbSpan(currentSpan, extendData);
  SpansContainer.addSpan(span);
};

function queryBeforeHook(args, extenderContext) {
  const awsRequestId = TracerGlobals.getHandlerInputs().context.awsRequestId;
  const transactionId = getCurrentTransactionId();
  const started = Date.now();
  let [query] = args;
  if (Array.isArray(query)) {
    query = query[0];
  }

  const connectionParameters = ActiveConnectionDetails.getActiveConnection();
  const spanId = getRandomId();
  const span = createMongoDbSpan(
    transactionId,
    awsRequestId,
    spanId,
    {
      started,
    },
    {
      databaseName: connectionParameters.database,
      commandName: extenderContext.funcName,
      command: query,
      mongoRequestId: 13,
      mongoOperationId: undefined,
      mongoConnectionId: 1,
    }
  );
  SpansContainer.addSpan(span);
  extenderContext.currentSpan = span;
}

function queryAfterHook(args, originalFnResult, extenderContext) {
  const { currentSpan } = extenderContext;
  if (isPromise(originalFnResult)) {
    hookPromise(originalFnResult, {
      thenHandler: (args) => {
        handleResult(currentSpan, args);
      },
      catchHandler: (args) => {
        handleResult(currentSpan, null, args);
      },
    });
  }
}

export const hookMongoose = (hookMongooseClient = null) => {
  const mongoose = hookMongooseClient || safeRequire('mongoose');
  if (mongoose) {
    logger.info('Starting to instrument mongoose');
    mongooseQueries.map((query) => {
      hook(
        mongoose.Model,
        query,
        {
          beforeHook: queryBeforeHook,
          afterHook: queryAfterHook,
        },
        { funcName: query }
      );
    });
    hook(mongoose, 'connect', {
      beforeHook: connectBeforeHook,
    });
  }
  logger.info('Mongoose instrumentation done');
};
