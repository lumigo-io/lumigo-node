import {
  isPromise,
  isSwitchedOff,
  isAwsEnvironment,
  getEdgeUrl,
  removeLumigoFromStacktrace,
  isStepFunction,
  safeExecute,
  getRandomId,
  LUMIGO_EVENT_KEY,
  STEP_FUNCTION_UID_KEY,
  getContextInfo,
  isTimeoutTimerEnabled,
  getTimeoutTimerBuffer,
  getTimeoutMinDuration,
} from './utils';
import {
  getFunctionSpan,
  getEndFunctionSpan,
  addRttToFunctionSpan,
  getCurrentTransactionId,
} from './spans/awsSpan';
import { sendSingleSpan, sendSpans } from './reporter';
import { TracerGlobals, SpansContainer, GlobalTimer, clearGlobals } from './globals';
import * as logger from './logger';
import { addStepFunctionEvent } from './hooks/http';

export const HANDLER_CALLBACKED = 'handler_callbacked';
export const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
export const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';
export const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
export const LEAK_MESSAGE =
  'Execution leak detected. More information is available in: https://docs.lumigo.io/docs/execution-leak-detected';

const setupTimeoutTimer = () => {
  logger.debug('Timeout timer set-up started');
  const { context } = TracerGlobals.getHandlerInputs();
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
};

export const startTrace = async () => {
  try {
    if (!isSwitchedOff() && isAwsEnvironment()) {
      const tracerInputs = TracerGlobals.getTracerInputs();
      const handlerInputs = TracerGlobals.getHandlerInputs();
      const { host, path } = getEdgeUrl();
      logger.debug('Tracer started', {
        tracerInputs,
        handlerInputs,
        host,
        path,
      });

      if (isTimeoutTimerEnabled()) setupTimeoutTimer();

      const functionSpan = getFunctionSpan();
      logger.debug('startTrace span created', functionSpan);

      const { rtt } = await sendSingleSpan(functionSpan);
      return addRttToFunctionSpan(functionSpan, rtt);
    }
    return null;
  } catch (err) {
    logger.warn('startTrace failure', err);
    return null;
  }
};

export const sendEndTraceSpans = async (functionSpan, handlerReturnValue) => {
  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);

  const spans = [...SpansContainer.getSpans(), endFunctionSpan];
  const currentTransactionId = getCurrentTransactionId();
  const spansToSend = [];
  const filteredSpans = [];
  spans.forEach(span => {
    span.transactionId === currentTransactionId ? spansToSend.push(span) : filteredSpans.push(span);
  });
  await sendSpans(spansToSend);
  const hasSpansFromPreviousInvocation = spansToSend.length !== spans.length;
  if (hasSpansFromPreviousInvocation) {
    logger.warnClient(LEAK_MESSAGE);
    filteredSpans.forEach(span => logger.debug('Leaked span: ', span));
  }
  const { transactionId } = endFunctionSpan;
  logger.debug('Tracer ended', { transactionId });
  clearGlobals();
};

export const isCallbacked = handlerReturnValue => {
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

export const callbackResolver = resolve => (err, data) =>
  resolve({ err, data, type: HANDLER_CALLBACKED });

// See https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
export const promisifyUserHandler = (userHandler, event, context) =>
  new Promise(resolve => {
    try {
      const result = userHandler(event, context, callbackResolver(resolve));
      if (isPromise(result)) {
        result
          .then(data => resolve({ err: null, data, type: ASYNC_HANDLER_RESOLVED }))
          .catch(err => resolve({ err, data: null, type: ASYNC_HANDLER_REJECTED }));
      }
    } catch (err) {
      resolve({ err, data: null, type: NON_ASYNC_HANDLER_ERRORED });
    }
  });

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

export const performStepFunctionLogic = handlerReturnValue => {
  return (
    safeExecute(() => {
      const { err, data, type } = handlerReturnValue;
      const messageId = getRandomId();

      addStepFunctionEvent(messageId);

      const modifiedData = Object.assign(data, {
        [LUMIGO_EVENT_KEY]: { [STEP_FUNCTION_UID_KEY]: messageId },
      });
      logger.debug(`Added key ${LUMIGO_EVENT_KEY} to the user's return value`);
      return { err, type, data: modifiedData };
    })() || handlerReturnValue
  );
};

export const trace = ({
  token,
  debug,
  edgeHost,
  switchOff,
  eventFilter,
  stepFunction,
}) => userHandler => async (event, context, callback) => {
  try {
    TracerGlobals.setHandlerInputs({ event, context });
    TracerGlobals.setTracerInputs({
      token,
      debug,
      edgeHost,
      switchOff,
      eventFilter,
      stepFunction,
    });
  } catch (err) {
    logger.warn('Failed to start tracer', err);
  }
  if (context.__wrappedByLumigo) {
    const { err, data, type } = await promisifyUserHandler(userHandler, event, context, callback);
    return performPromisifyType(err, data, type, callback);
  }
  context.__wrappedByLumigo = true;

  const pStartTrace = startTrace();
  const pUserHandler = promisifyUserHandler(userHandler, event, context, callback);

  let [functionSpan, handlerReturnValue] = await Promise.all([pStartTrace, pUserHandler]);

  if (isStepFunction()) {
    handlerReturnValue = performStepFunctionLogic(handlerReturnValue);
  }

  const cleanedHandlerReturnValue = removeLumigoFromStacktrace(handlerReturnValue);

  await endTrace(functionSpan, cleanedHandlerReturnValue);
  const { err, data, type } = cleanedHandlerReturnValue;

  return performPromisifyType(err, data, type, callback);
};
