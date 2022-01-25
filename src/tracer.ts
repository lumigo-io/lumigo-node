import {
  getContextInfo,
  getEdgeUrl,
  getRandomId,
  getTimeoutMinDuration,
  getTimeoutTimerBuffer,
  isAwsEnvironment,
  isPromise,
  isStepFunction,
  isSwitchedOff,
  isTimeoutTimerEnabled,
  LUMIGO_EVENT_KEY,
  removeLumigoFromStacktrace,
  safeExecute,
  STEP_FUNCTION_UID_KEY,
} from './utils';
import {
  getEndFunctionSpan,
  getFunctionSpan,
  isSpanIsFromAnotherInvocation,
} from './spans/awsSpan';
import { sendSingleSpan, sendSpans } from './reporter';
import { clearGlobals, GlobalTimer, SpansContainer, TracerGlobals, ExecutionTags } from './globals';
import * as logger from './logger';
import { Http } from './hooks/http';
import { runOneTimeWrapper } from './utils/functionUtils';
import { isAwsContext } from './guards/awsGuards';

export const HANDLER_CALLBACKED = 'handler_callbacked';
export const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
export const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';
export const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
export const MAX_ELEMENTS_IN_EXTRA = 10;
export const LEAK_MESSAGE =
  'Execution leak detected. More information is available in: https://docs.lumigo.io/docs/execution-leak-detected';

const setupTimeoutTimer = () => {
  logger.debug('Timeout timer set-up started');
  const { context } = TracerGlobals.getHandlerInputs();
  if (isAwsContext(context)) {
    const { remainingTimeInMillis } = getContextInfo(context);
    const timeoutBuffer = getTimeoutTimerBuffer();
    const minDuration = getTimeoutMinDuration();
    if (timeoutBuffer < remainingTimeInMillis && remainingTimeInMillis >= minDuration) {
      GlobalTimer.setGlobalTimeout(async () => {
        logger.debug('Invocation is about to timeout, sending trace data.');
        const spans = SpansContainer.getSpans();
        SpansContainer.clearSpans();
        await sendSpans(spans);
      }, remainingTimeInMillis - timeoutBuffer);
    }
  }
};

export const startTrace = async (functionSpan) => {
  try {
    const handlerInputs = TracerGlobals.getHandlerInputs();
    if (!isSwitchedOff() && isAwsEnvironment() && isAwsContext(handlerInputs.context)) {
      const tracerInputs = TracerGlobals.getTracerInputs();
      const { host, path } = getEdgeUrl();
      logger.debug('Tracer started', {
        tracerInputs,
        handlerInputs,
        host,
        path,
      });

      if (isTimeoutTimerEnabled()) setupTimeoutTimer();

      await sendSingleSpan(functionSpan);
    }
  } catch (err) {
    logger.warn('startTrace failure', err);
  }
};

const logLeakedSpans = (allSpans) => {
  const warnClientOnce = runOneTimeWrapper(logger.warnClient);
  allSpans.forEach((span) => {
    if (isSpanIsFromAnotherInvocation(span)) {
      logger.debug('Leaked span: ', span);
      const httpInfo = span.info ? span.info.httpInfo : {};
      warnClientOnce(LEAK_MESSAGE, httpInfo);
    }
  });
};

export const sendEndTraceSpans = async (functionSpan, handlerReturnValue) => {
  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
  const spans = [...SpansContainer.getSpans(), endFunctionSpan];

  await sendSpans(spans);
  logLeakedSpans(spans);

  const { transactionId } = endFunctionSpan;
  logger.debug('Tracer ended', { transactionId });
  clearGlobals();
};

export const isCallbacked = (handlerReturnValue) => {
  const { type } = handlerReturnValue;
  return type === HANDLER_CALLBACKED;
};

export const endTrace = async (functionSpan, handlerReturnValue) => {
  try {
    if (functionSpan && !isSwitchedOff() && isAwsEnvironment()) {
      await sendEndTraceSpans(functionSpan, handlerReturnValue);
    }
  } catch (err) {
    logger.warn('endTrace failure', err);
    clearGlobals();
  }
};

export const callbackResolver = (resolve) => (err, data) =>
  resolve({ err, data, type: HANDLER_CALLBACKED });

// See https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
export function promisifyUserHandler(
  userHandler,
  event,
  context
): Promise<{ err: any; data: any; type: string }> {
  return new Promise((resolve) => {
    try {
      const result = userHandler(event, context, callbackResolver(resolve));
      if (isPromise(result)) {
        result
          .then((data) => resolve({ err: null, data, type: ASYNC_HANDLER_RESOLVED }))
          .catch((err) => resolve({ err, data: null, type: ASYNC_HANDLER_REJECTED }));
      }
    } catch (err) {
      resolve({ err, data: null, type: NON_ASYNC_HANDLER_ERRORED });
    }
  });
}

const performPromisifyType = (err, data, type, callback) => {
  switch (type) {
    case HANDLER_CALLBACKED:
      callback(err, data);
      break;
    case ASYNC_HANDLER_RESOLVED:
      return data;
    case NON_ASYNC_HANDLER_ERRORED:
    case ASYNC_HANDLER_REJECTED:
      throw err;
  }
};

export const normalizeLambdaError = (handlerReturnValue) => {
  // Normalizing lambda error according to Lambda normalize process
  let { err, data, type } = handlerReturnValue;
  if (err && !(err instanceof Error)) err = new Error(err);
  return { err, data, type };
};

export const performStepFunctionLogic = (handlerReturnValue) => {
  return (
    safeExecute(() => {
      const { err, data, type } = handlerReturnValue;
      const messageId = getRandomId();

      Http.addStepFunctionEvent(messageId);

      const modifiedData = Object.assign(data, {
        [LUMIGO_EVENT_KEY]: { [STEP_FUNCTION_UID_KEY]: messageId },
      });
      logger.debug(`Added key ${LUMIGO_EVENT_KEY} to the user's return value`);
      return { err, type, data: modifiedData };
    })() || handlerReturnValue
  );
};

// @ts-ignore
const events = process._events;
const { unhandledRejection } = events;
const originalUnhandledRejection = unhandledRejection;
export const hookUnhandledRejection = async (functionSpan) => {
  events.unhandledRejection = async (reason, promise) => {
    events.unhandledRejection = originalUnhandledRejection;
    const err = Error(reason);
    err.name = 'Runtime.UnhandledPromiseRejection';
    await endTrace(functionSpan, {
      err: err,
      type: ASYNC_HANDLER_REJECTED,
      data: null,
    }).then(() => {
      typeof originalUnhandledRejection === 'function' &&
        originalUnhandledRejection(reason, promise);
    });
  };
};

export const trace =
  ({ token, debug, edgeHost, switchOff, stepFunction }) =>
  (userHandler) =>
  async (event, context, callback) => {
    if (!isAwsEnvironment()) return userHandler(event, context, callback);
    try {
      TracerGlobals.setHandlerInputs({ event, context });
      TracerGlobals.setTracerInputs({
        token,
        debug,
        edgeHost,
        switchOff,
        stepFunction,
        lambdaTimeout: context.getRemainingTimeInMillis(),
      });
      ExecutionTags.autoTagEvent(event);
    } catch (err) {
      logger.warn('Failed to start tracer', err);
    }

    if (!context || !isAwsContext(context)) {
      logger.warnClient(
        'missing context parameter - learn more at https://docs.lumigo.io/docs/nodejs'
      );
      const { err, data, type } = await promisifyUserHandler(userHandler, event, context);
      return performPromisifyType(err, data, type, callback);
    }

    if (context.__wrappedByLumigo) {
      const { err, data, type } = await promisifyUserHandler(userHandler, event, context);
      return performPromisifyType(err, data, type, callback);
    }
    context.__wrappedByLumigo = true;

    const functionSpan = getFunctionSpan(event, context);

    await hookUnhandledRejection(functionSpan);

    const pStartTrace = startTrace(functionSpan);
    const pUserHandler = promisifyUserHandler(userHandler, event, context);

    let [, handlerReturnValue] = await Promise.all([pStartTrace, pUserHandler]);

    handlerReturnValue = normalizeLambdaError(handlerReturnValue);

    if (isStepFunction()) {
      handlerReturnValue = performStepFunctionLogic(handlerReturnValue);
    }

    const cleanedHandlerReturnValue = removeLumigoFromStacktrace(handlerReturnValue);

    await endTrace(functionSpan, cleanedHandlerReturnValue);
    const { err, data, type } = cleanedHandlerReturnValue;

    return performPromisifyType(err, data, type, callback);
  };
