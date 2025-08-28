import { safeRequire } from '../utils/requireUtils';
import * as logger from '../logger';
import { hook, hookPromise } from '../extender';
import { getRandomId, isPromise } from '../utils';
import { SpansContainer, TracerGlobals } from '../globals';
import { extendSqlSpan, createSqlSpan } from '../spans/sqlSpan';
import { payloadStringify } from '../utils/payloadStringify';
import { getCurrentTransactionId, MSSQL_SPAN } from '../spans/awsSpan';

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
    extendData.error = payloadStringify(error);
  } else {
    if (result) {
      const { recordset, rowsAffected } = result;
      extendData.result = {
        rowCount: rowsAffected,
        rows: payloadStringify(recordset),
      };
    }
  }
  const span = extendSqlSpan(currentSpan, extendData);
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
  const span = createSqlSpan(
    transactionId,
    awsRequestId,
    spanId,
    { started },
    { query, connectionParameters },
    MSSQL_SPAN
  );
  SpansContainer.addSpan(span);
  extenderContext.currentSpan = span;

  if (typeof args[1] === 'function') {
    hook(args, '1', {
      beforeHook: function (args) {
        const [error, dbResult] = args;
        handleResult(span, dbResult, error);
      },
    });
  }
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

export const hookMssql = (mssqlClient = null) => {
  const mssql = mssqlClient || safeRequire('mssql');
  if (mssql) {
    logger.info('Starting to instrument mssql');
    hook(mssql.Request.prototype, 'query', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
    hook(mssql, 'connect', {
      beforeHook: connectBeforeHook,
    });
    hook(mssql.ConnectionPool.prototype, 'connect', {
      beforeHook: connectBeforeHook,
    });
  }
};
