import { safeRequire } from '../utils/requireUtils';
import * as logger from '../logger';
import { hook } from '../extender';
import { getRandomId, isPromise, safeExecute } from '../utils';
import { SpansContainer, TracerGlobals } from '../globals';
import { extendSqlSpan, createSqlSpan } from '../spans/sqlSpan';
import { payloadStringify } from '../utils/payloadStringify';
import { getCurrentTransactionId, MSSQL_SPAN } from '../spans/awsSpan';

const ActiveConnectionDetails = (() => {
  let _activeConnection = {};

  const getActiveConnection = () => _activeConnection;

  const updateActiveConnection = mssqlConnectionString => {
    const uri = new URL(mssqlConnectionString);
    const database = uri.pathname.replace('/', '');
    _activeConnection = {
      user: uri.username,
      host: uri.hostname,
      port: uri.port,
      database: database,
    };
  };

  return {
    getActiveConnection,
    updateActiveConnection,
  };
})();

function connectBeforeHook(args) {
  if (typeof args[0] === 'string') ActiveConnectionDetails.updateActiveConnection(args[0]);
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
  console.log('Got query args', args);
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
      beforeHook: function(args) {
        const [error, dbResult] = args;
        console.log('Got DB RESULT', error, dbResult);
        handleResult(span, dbResult, error);
      },
    });
  }
}

function queryAfterHook(args, originalFnResult, extenderContext) {
  const { currentSpan } = extenderContext;
  const safeHandler = safeExecute(result => {
    handleResult(currentSpan, result);
  });
  if (isPromise(originalFnResult)) {
    originalFnResult.then(safeHandler);
  }
}

export const hookMssql = (mssqlClient = null) => {
  const mssql = mssqlClient || safeRequire('mssql');
  if (mssql) {
    logger.info('Starting to instrument mssql');
    hook(mssql, 'query', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
    hook(mssql, 'connect', {
      beforeHook: connectBeforeHook,
    });
  }
};
