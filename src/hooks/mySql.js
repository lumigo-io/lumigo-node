import { safeRequire } from '../utils/requireUtils';
import * as logger from '../logger';
import { hook } from '../extender';
import { getRandomId, isObject, isString } from '../utils';
import { SpansContainer, TracerGlobals } from '../globals';
import { extendSqlSpan, createSqlSpan } from '../spans/sqlSpan';
import { payloadStringify } from '../utils/payloadStringify';
import { getCurrentTransactionId, MYSQL_SPAN } from '../spans/awsSpan';

const createResultHook = (currentSpan) => (args) => {
  const ended = Date.now();
  let extendData = { ended };
  const [error, result] = args;
  if (error) {
    extendData.error = payloadStringify(error);
  } else {
    if (result) {
      extendData.result = {
        rows: payloadStringify(result),
      };
    }
  }
  const extendedSpan = extendSqlSpan(currentSpan, extendData);
  SpansContainer.addSpan(extendedSpan);
};

function extractQueryFromArg(arg) {
  if (isObject(arg)) {
    return arg['sql'] || 'unknown';
  } else if (isString(arg)) {
    return arg;
  } else {
    return 'unknown';
  }
}

function queryBeforeHook(args, extenderContext) {
  const awsRequestId = TracerGlobals.getHandlerInputs().context.awsRequestId;
  const transactionId = getCurrentTransactionId();
  const query = extractQueryFromArg(args[0]);
  const values = Array.isArray(args[1]) ? args[1] : [];
  const connectionParameters = this.config;

  const spanId = getRandomId();
  const started = Date.now();

  const span = createSqlSpan(
    transactionId,
    awsRequestId,
    spanId,
    {
      started,
    },
    { connectionParameters, query, values },
    MYSQL_SPAN
  );

  SpansContainer.addSpan(span);
  extenderContext.currentSpan = span;
}

function queryAfterHook(args, originalFnResult, extenderContext) {
  const { currentSpan } = extenderContext;
  const beforeHook = createResultHook(currentSpan);
  const hookOptions = { beforeHook };
  if (originalFnResult.onResult) {
    //mysql2
    hook(originalFnResult, 'onResult', hookOptions);
  } else {
    if (originalFnResult._callback) {
      //mysql
      hook(originalFnResult, '_callback', hookOptions);
    }
  }
}

export const hookMySql = (mySqlClient = null) => {
  const mySql = mySqlClient || safeRequire('mysql/lib/Connection.js');
  if (mySql) {
    logger.info('Starting to instrument mysql');
    hook(mySql.prototype, 'query', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
  }
  const mySql2 = mySqlClient || safeRequire('mysql2');
  if (mySql2) {
    logger.info('Starting to instrument mysql2');
    hook(mySql2.Connection.prototype, 'execute', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
    hook(mySql2.Connection.prototype, 'query', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
  }
};
