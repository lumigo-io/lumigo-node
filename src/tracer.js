import { isSwitchedOff, isAwsEnvironment, isAsyncFn } from './utils';
import {
  getFunctionSpan,
  getEndFunctionSpan,
  addRttToFunctionSpan,
} from './spans/awsSpan';
import { sendSingleSpan, sendSpans } from './reporter';
import { TracerGlobals, SpansContainer, clearGlobals } from './globals';
import startHooks from './hooks';
import * as logger from './logger';

export const NON_ASYNC_HANDLER_CALLBACKED = 'non_async_callbacked';
export const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
export const ASYNC_HANDLER_CALLBACKED = 'async_callbacked';
export const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
export const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';

export const startTrace = async () => {
  try {
    if (!isSwitchedOff() && isAwsEnvironment()) {
      const functionSpan = getFunctionSpan();
      const { rtt } = await sendSingleSpan(functionSpan);
      return addRttToFunctionSpan(functionSpan, rtt);
    } else {
      return null;
    }
  } catch (err) {
      logger.fatal('startTrace failure', err);
    return null;
  }
};

export const endTrace = async (functionSpan, handlerReturnValue) => {
  try {
    if (functionSpan && !isSwitchedOff() && isAwsEnvironment()) {
      const endFunctionSpan = getEndFunctionSpan(
        functionSpan,
        handlerReturnValue
      );
      SpansContainer.addSpan(endFunctionSpan);

      const spans = SpansContainer.getSpans();
      await sendSpans(spans);
      logger.debug('Tracer ended')
      clearGlobals();
    }
  } catch (err) {
    logger.fatal('endTrace failure', err);
    clearGlobals();
  }
};

export const asyncCallbackResolver = resolve => (err, data) =>
  resolve({ err, data, type: ASYNC_HANDLER_CALLBACKED });

export const nonAsyncCallbackResolver = resolve => (err, data) =>
  resolve({ err, data, type: NON_ASYNC_HANDLER_CALLBACKED });

// See https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
export const promisifyUserHandler = (userHandler, event, context) =>
  new Promise(resolve => {
    if (isAsyncFn(userHandler)) {
      return userHandler(event, context, asyncCallbackResolver(resolve))
        .then(data =>
          resolve({ err: null, data, type: ASYNC_HANDLER_RESOLVED })
        )
        .catch(err =>
          resolve({ err, data: null, type: ASYNC_HANDLER_REJECTED })
        );
    } else {
      try {
        userHandler(event, context, nonAsyncCallbackResolver(resolve));
      } catch (err) {
        resolve({ err, data: null, type: NON_ASYNC_HANDLER_ERRORED });
      }
    }
  });

export const trace = ({
  token,
  debug,
  edgeHost,
  switchOff,
  eventFilter,
}) => userHandler => async (event, context, callback) => {
  TracerGlobals.setHandlerInputs({ event, context });
  TracerGlobals.setTracerInputs({
    token,
    debug,
    edgeHost,
    switchOff,
    eventFilter,
  });

  startHooks();

  const pStartTrace = startTrace();
  const pUserHandler = promisifyUserHandler(
    userHandler,
    event,
    context,
    callback
  );

  const [functionSpan, handlerReturnValue] = await Promise.all([
    pStartTrace,
    pUserHandler,
  ]);

  await endTrace(functionSpan, handlerReturnValue);

  const { err, data, type } = handlerReturnValue;
  switch (type) {
    case ASYNC_HANDLER_CALLBACKED:
    case NON_ASYNC_HANDLER_CALLBACKED:
      callback(err, data);
      break;
    case ASYNC_HANDLER_RESOLVED:
      return data;
    case NON_ASYNC_HANDLER_ERRORED:
    case ASYNC_HANDLER_REJECTED:
      throw err;
  }
};
