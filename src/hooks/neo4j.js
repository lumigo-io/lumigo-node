import { safeRequire } from '../utils/requireUtils';
import * as logger from '../logger';
import { hook, hookPromise } from '../extender';
import { getRandomId } from '../utils';
import { SpansContainer, TracerGlobals } from '../globals';
import { extendNeo4jSpan, createNeo4jSpan } from '../spans/neo4jSpan';
import { payloadStringify } from '../utils/payloadStringify';
import { getCurrentTransactionId, NEO4J_SPAN } from '../spans/awsSpan';

function queryBeforeHook(args, extenderContext) {
  const awsRequestId = TracerGlobals.getHandlerInputs().context.awsRequestId;
  const transactionId = getCurrentTransactionId();
  const query = args[0];
  const params = args[1];
  const spanId = getRandomId();
  const started = Date.now();

  const connectionHolder = this._connectionHolderWithMode(this._mode);
  const connectionParameters = {
    mode: this._mode,
    host: connectionHolder._connectionProvider._seedRouter._host,
    port: connectionHolder._connectionProvider._seedRouter._port,
    database: connectionHolder._database,
    user: connectionHolder._connectionProvider._authToken.principal,
  };

  const span = createNeo4jSpan(
    transactionId,
    awsRequestId,
    spanId,
    { started },
    { connectionParameters, query, params },
    NEO4J_SPAN
  );

  SpansContainer.addSpan(span);
  extenderContext.currentSpan = span;
}

const createResultHook = (currentSpan, originalResult) => {
  const ended = Date.now();
  const extendedSpan = extendNeo4jSpan(currentSpan, {
    ended,
    database: originalResult.summary.database.name,
    response: payloadStringify(originalResult.records, undefined, [[], 'keys']),
    summary: payloadStringify(originalResult.summary),
  });
  SpansContainer.addSpan(extendedSpan);
};

const createErrorHook = (currentSpan, error) => {
  const ended = Date.now();
  const extendedSpan = extendNeo4jSpan(currentSpan, {
    ended,
    error: payloadStringify(error),
  });
  SpansContainer.addSpan(extendedSpan);
};

function queryAfterHook(args, originalFnResult, extenderContext) {
  const { currentSpan } = extenderContext;
  hookPromise(originalFnResult, {
      thenHandler: (args) => {
        createResultHook(currentSpan, args);
      },
      catchHandler: (error) => {
        createErrorHook(currentSpan, error);
      },
    });
}

export const hookNeo4j = (neo4JClient = null) => {
  const neo4j = neo4JClient || safeRequire('neo4j-driver/lib/session.js');
  if (neo4j && neo4j.default) {
    logger.info('Starting to instrument neo4j');
    hook(neo4j.default.prototype, 'run', {
      beforeHook: queryBeforeHook,
      afterHook: queryAfterHook,
    });
  }
};
