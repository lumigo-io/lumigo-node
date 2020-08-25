import { safeRequire } from '../utils/requireUtils';
import * as logger from '../logger';
import { hook } from '../extender';
import { getRandomId, safeExecute } from '../utils';
import { createPgSpan, extendPgSpan } from '../spans/pgSpan';
import { SpansContainer } from '../globals';
import { payloadStringify } from '../utils/payloadStringify';

function queryBeforeHook(args, extenderContext) {
  const started = Date.now();
  const [query] = args;
  const { connectionParameters } = this;
  const spanId = getRandomId();
  const span = createPgSpan(spanId, { started }, { query, connectionParameters });
  SpansContainer.addSpan(span);
  extenderContext.currentSpan = span;
}

const handlePgResponse = (currentSpan, error, result) => {
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
  const span = extendPgSpan(currentSpan, extendData);
  SpansContainer.addSpan(span);
};

function queryAfterHook(args, originalFnResult, extenderContext) {
  // If the query function not receive callback, he will return a Promise
  const { currentSpan } = extenderContext;
  if (args[1] instanceof Function || args[2] instanceof Function) {
    hook(this.activeQuery, 'callback', {
      beforeHook: args => {
        const [error, result] = args;
        handlePgResponse(currentSpan, error, result);
      },
    });
  } else {
    if (originalFnResult instanceof Promise) {
      originalFnResult.then(
        safeExecute(result => {
          handlePgResponse(currentSpan, null, result);
        }),
        safeExecute(error => {
          handlePgResponse(currentSpan, error, null);
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
};
