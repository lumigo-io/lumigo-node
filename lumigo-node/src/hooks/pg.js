import { safeRequire } from '../utils/requireUtils';
import * as logger from '../logger';
import { hook } from '../extender';
import { getRandomId, safeExecute, safeGet } from '../utils';
import { createSqlSpan, extendSqlSpan } from '../spans/sqlSpan';
import { SpansContainer, TracerGlobals } from '../globals';
import { payloadStringify } from '../utils/payloadStringify';
import { getCurrentTransactionId, PG_SPAN } from '../spans/awsSpan';

function queryBeforeHook(args, extenderContext) {
  const awsRequestId = TracerGlobals.getHandlerInputs().context.awsRequestId;
  const transactionId = getCurrentTransactionId();
  const started = Date.now();
  let [query] = args;
  let values;
  if (query.constructor === Object) {
    values = safeGet(query, ['values']);
    query = safeGet(query, ['text']);
  } else {
    values = Array.isArray(args[1]) ? args[1] : [];
  }
  const { connectionParameters } = this;
  const spanId = getRandomId();
  const span = createSqlSpan(
    transactionId,
    awsRequestId,
    spanId,
    { started },
    { query, connectionParameters, values },
    PG_SPAN
  );
  SpansContainer.addSpan(span);
  extenderContext.currentSpan = span;
}

const createSpanFromPgResponse = (currentSpan, error, result) => {
  const ended = Date.now();
  let extendData = { ended };
  if (error) {
    extendData.error = payloadStringify(error);
  } else {
    if (result) {
      extendData.result = {
        rowCount: result.rowCount,
        rows: payloadStringify(result.rows),
      };
    }
  }
  const span = extendSqlSpan(currentSpan, extendData);
  SpansContainer.addSpan(span);
};

function findActiveQuery(queryQueue = [], cb) {
  return queryQueue.find((activeQuery) => activeQuery.callback === cb);
}

function queryAfterHook(args, originalFnResult, extenderContext) {
  // If the query function doesn't receive a callback, it will return a Promise
  const { currentSpan } = extenderContext;
  if (args[1] instanceof Function || args[2] instanceof Function) {
    const callback = args[1] instanceof Function ? args[1] : args[2];
    let activeQuery = this.activeQuery || findActiveQuery(this.queryQueue, callback);
    if (activeQuery) {
      hook(activeQuery, 'callback', {
        beforeHook: (args) => {
          const [error, result] = args;
          createSpanFromPgResponse(currentSpan, error, result);
        },
      });
    }
    !activeQuery && logger.warn('No active query found, Not instrumenting pg response!');
  } else {
    if (originalFnResult instanceof Promise) {
      originalFnResult.then(
        safeExecute((result) => {
          createSpanFromPgResponse(currentSpan, null, result);
        }),
        safeExecute((error) => {
          createSpanFromPgResponse(currentSpan, error, null);
        })
      );
    }
  }
}

export const hookPg = (pgClient = null) => {
  const pg = pgClient || safeRequire('pg');
  if (pg) {
    logger.info('Starting to instrument pg');
    hook(pg.Client.prototype, 'query', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
  }
  const pgPool = pgClient || safeRequire('pg-pool');
  if (pgPool) {
    logger.info('Starting to instrument pg-pool');
    hook(pgPool.prototype, 'query', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
  }
};
