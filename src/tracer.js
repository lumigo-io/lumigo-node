import {
  isPromise,
  isSwitchedOff,
  isAwsEnvironment,
  getEdgeUrl,
  removeLumigoFromStacktrace,
  isSendOnlyIfErrors,
} from './utils';
import {
  getFunctionSpan,
  getEndFunctionSpan,
  addRttToFunctionSpan,
  getCurrentTransactionId,
} from './spans/awsSpan';
import { sendSingleSpan, sendSpans } from './reporter';
import { TracerGlobals, SpansContainer, clearGlobals } from './globals';
import startHooks from './hooks';
import * as logger from './logger';

export const HANDLER_CALLBACKED = 'handler_callbacked';
export const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
export const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';
export const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
export const LEAK_MESSAGE =
  'Execution leak detected. More information is available in: https://docs.lumigo.io/docs/execution-leak-detected';

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

      const functionSpan = getFunctionSpan();
      logger.debug('startTrace span created', functionSpan);

      if (!isSendOnlyIfErrors()) {
        const { rtt } = await sendSingleSpan(functionSpan);
        return addRttToFunctionSpan(functionSpan, rtt);
      } else {
        logger.debug(
          "Skip sending start span because tracer in 'send only if error' mode ."
        );
        return null;
      }
    } else {
      return null;
    }
  } catch (err) {
    logger.fatal('startTrace failure', err);
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
    span.transactionId === currentTransactionId
      ? spansToSend.push(span)
      : filteredSpans.push(span);
  });
  await sendSpans(spansToSend);
  const hasSpansFromPreviousInvocation = spansToSend.length !== spans.length;
  if (hasSpansFromPreviousInvocation) {
    logger.warnClient(LEAK_MESSAGE);
    filteredSpans.forEach(span => logger.debug('Leaked span: ', span));
  }
  logger.debug('Tracer ended');
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
    logger.fatal('endTrace failure', err);
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
          .then(data =>
            resolve({ err: null, data, type: ASYNC_HANDLER_RESOLVED })
          )
          .catch(err =>
            resolve({ err, data: null, type: ASYNC_HANDLER_REJECTED })
          );
      }
    } catch (err) {
      resolve({ err, data: null, type: NON_ASYNC_HANDLER_ERRORED });
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

  if (context.wrapped_by_lumigo) {
    return userHandler(event, context, callback);
  }
  context.wrapped_by_lumigo = true;

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

  const cleanedHandlerReturnValue = removeLumigoFromStacktrace(
    handlerReturnValue
  );

  await endTrace(functionSpan, cleanedHandlerReturnValue);
  const { err, data, type } = cleanedHandlerReturnValue;

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
