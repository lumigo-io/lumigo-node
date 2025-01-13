import type { Callback, Context, Handler } from 'aws-lambda';

import {
  clearGlobals,
  ExecutionTags,
  GlobalTimer,
  SpansContainer,
  TracerGlobals,
} from '../globals';
import { isAwsContext } from '../guards/awsGuards';
import { Http } from '../hooks/http';
import * as logger from '../logger';
import { info, warnClient } from '../logger';
import { sendSingleSpan, sendSpans } from '../reporter';
import {
  getEndFunctionSpan,
  getFunctionSpan,
  isSpanIsFromAnotherInvocation,
} from '../spans/awsSpan';
import {
  getContextInfo,
  getEdgeUrl,
  getRandomId,
  getTimeoutMinDuration,
  getTimeoutTimerBuffer,
  isAwsEnvironment,
  isPromise,
  isSwitchedOff,
  isStepFunction,
  isTimeoutTimerEnabled,
  LUMIGO_EVENT_KEY,
  removeLumigoFromStacktrace,
  safeExecute,
  STEP_FUNCTION_UID_KEY,
  SWITCH_OFF_FLAG,
  removeLumigoFromError,
} from '../utils';
import { runOneTimeWrapper } from '../utils/functionUtils';
import { TraceOptions } from './trace-options.type';
import { GenericSpan } from '../types/spans/basicSpan';
import { ResponseStream, ResponseStreamHandler } from './tracer.interface';

export const HANDLER_CALLBACKED = 'handler_callbacked';
export const HANDLER_STREAMING = Symbol.for('aws.lambda.runtime.handler.streaming');
export const STREAM_RESPONSE = 'response';
export const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
export const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';
export const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
export const MAX_ELEMENTS_IN_EXTRA = 10;
export const LEAK_MESSAGE =
  'Execution leak detected. More information is available in: https://docs.lumigo.io/docs/execution-leak-detected';

export const trace =
  ({ token, debug, edgeHost, switchOff, stepFunction }: TraceOptions) =>
  <T extends Handler | ResponseStreamHandler>(userHandler: T) => {
    const isResponseStreamFunction = userHandler[HANDLER_STREAMING] === STREAM_RESPONSE;
    const decoratedUserHandler = async <Event = any>(
      event: Event,
      context?: Context,
      callback?: Callback
    ): Promise<Handler> => {
      if (!!switchOff || isSwitchedOff()) {
        info(
          `The '${SWITCH_OFF_FLAG}' environment variable is set to 'true': this invocation will not be traced by Lumigo`
        );
        // @ts-ignore
        return userHandler(event, context, callback);
      }

      if (!isAwsEnvironment()) {
        warnClient('Tracer is disabled, running on non-aws environment');
        // @ts-ignore
        return userHandler(event, context, callback);
      }

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

    const decoratedResponseStreamUserHandler = async <Event = any>(
      event: Event,
      responseStream?: ResponseStream,
      context?: Context,
      callback?: Callback
    ): Promise<ResponseStreamHandler> => {
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

      const functionSpan = getFunctionSpan(event, context);

      await hookUnhandledRejection(functionSpan);

      const pStartTrace = startTrace(functionSpan);
      const pUserHandler = promisifyUserResponseStreamHandler(
        userHandler,
        event,
        responseStream,
        context
      );

      let [, handlerReturnValue] = await Promise.all([pStartTrace, pUserHandler]);

      handlerReturnValue = normalizeLambdaError(handlerReturnValue);

      const cleanedHandlerReturnValue = removeLumigoFromStacktrace(handlerReturnValue);

      await endTrace(functionSpan, cleanedHandlerReturnValue);
      const { err, data, type } = cleanedHandlerReturnValue;

      return performPromisifyType(err, data, type, callback);
    };

    if (isResponseStreamFunction) {
      logger.debug('Function has response stream in the handler');
      decoratedResponseStreamUserHandler[HANDLER_STREAMING] = STREAM_RESPONSE;
      return decoratedResponseStreamUserHandler as T;
    } else {
      return decoratedUserHandler as T;
    }
  };

export const startTrace = async (functionSpan: GenericSpan) => {
  try {
    const handlerInputs = TracerGlobals.getHandlerInputs();

    const shouldRunTracer =
      !isSwitchedOff() && isAwsEnvironment() && isAwsContext(handlerInputs.context);
    if (shouldRunTracer) {
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

export const endTrace = async (functionSpan: GenericSpan, handlerReturnValue: any) => {
  try {
    if (functionSpan && !isSwitchedOff() && isAwsEnvironment()) {
      await sendEndTraceSpans(functionSpan, handlerReturnValue);
    }
  } catch (err) {
    logger.warn('endTrace failure', err);
    clearGlobals();
  }
};

export const sendEndTraceSpans = async (functionSpan: GenericSpan, handlerReturnValue: any) => {
  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
  SpansContainer.addSpan(endFunctionSpan, true);

  await sendSpans(SpansContainer.getSpans());
  logLeakedSpans(SpansContainer.getSpans());

  const { transactionId } = endFunctionSpan;
  logger.debug('Tracer ended', { transactionId, totalSpans: SpansContainer.getTotalSpans() });
  clearGlobals();
};

export const callbackResolver = (resolve) => (err, data) =>
  resolve({ err, data, type: HANDLER_CALLBACKED });

export const isCallbacked = (handlerReturnValue) => {
  const { type } = handlerReturnValue;
  return type === HANDLER_CALLBACKED;
};

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

export function promisifyUserResponseStreamHandler(
  userHandler,
  event,
  responseStream,
  context
): Promise<{ err: any; data: any; type: string }> {
  return new Promise((resolve) => {
    try {
      const result = userHandler(event, responseStream, context, callbackResolver(resolve));
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

export const normalizeLambdaError = (handlerReturnValue) => {
  // Normalizing lambda error according to Lambda normalize process
  const { data, type } = handlerReturnValue;
  let { err } = handlerReturnValue;
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

// we wrap the unhandledRejection method to send the function span before the process ends
export const hookUnhandledRejection = async (functionSpan) => {
  // @ts-ignore - we're overriding an accessor we usually shouldn't have access to
  const events = process._events;
  const { unhandledRejection } = events;
  const originalUnhandledRejection = unhandledRejection;
  events.unhandledRejection = async (reason, promise) => {
    const err = Error(reason);
    err.name = 'Runtime.UnhandledPromiseRejection';
    try {
      err.stack = removeLumigoFromError(err.stack);
    } catch (errFromRemoveLumigo) {
      logger.warn('Failed to remove Lumigo from stacktrace', errFromRemoveLumigo);
    }
    await endTrace(functionSpan, {
      err: err,
      type: ASYNC_HANDLER_REJECTED,
      data: null,
    }).then(() => {
      if (typeof originalUnhandledRejection === 'function') {
        originalUnhandledRejection(reason, promise);
      }
    });
  };
};

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
        await sendSpans(SpansContainer.getSpans());
        SpansContainer.clearSpans();
      }, remainingTimeInMillis - timeoutBuffer);
    }
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

const performPromisifyType = <T extends Handler | ResponseStreamHandler>(
  err,
  data: T,
  type,
  callback
): T => {
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
