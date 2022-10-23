import * as logger from './logger';
import type { TracerOptions } from './tracer';
import type { LambdaContext } from './types/aws/awsEnvironment';
import {
  getAutoTagKeys,
  getJSONBase64Size,
  getMaxRequestSize,
  isLambdaTraced,
  spanHasErrors,
} from './utils';
import { GlobalDurationTimer } from './utils/globalDurationTimer';

const MAX_TAGS = 50;
const MAX_TAG_KEY_LEN = 50;
const MAX_TAG_VALUE_LEN = 70;
const ADD_TAG_ERROR_MSG_PREFIX = 'Skipping addExecutionTag: Unable to add tag';
export const DEFAULT_MAX_SIZE_FOR_REQUEST = 1024 * 500;
export const MAX_TRACER_ADDED_DURATION_ALLOWED = 750;
export const MIN_TRACER_ADDED_DURATION_ALLOWED = 200;

export const SpansContainer = (() => {
  let spansToSend = {};
  let currentSpansSize = 0;
  const addSpan = (span) => {
    // Memory optimization
    if (spanHasErrors(span) || getMaxRequestSize() > currentSpansSize) {
      spansToSend[span.id] = span;
      currentSpansSize += getJSONBase64Size(span);
      logger.debug('Span created', span);
      return true;
    }
    return false;
  };
  const getSpans = () => Object.values(spansToSend);
  const getSpanById = (spanId: string) => spansToSend[spanId];
  const changeSpanId = (oldId: string, newId: string) => {
    const oldSpan = spansToSend[oldId];
    if (oldSpan) {
      oldSpan.id = newId;
      spansToSend[newId] = oldSpan;
    }
    delete spansToSend[oldId];
  };
  const clearSpans = () => {
    currentSpansSize = 0;
    spansToSend = {};
  };

  return { addSpan, getSpanById, getSpans, clearSpans, changeSpanId };
})();

export const GlobalTimer = (() => {
  let currentTimer = undefined;

  const setGlobalTimeout = (func, duration) => {
    clearTimer();
    currentTimer = setTimeout(func, duration);
    currentTimer.unref();
  };

  const clearTimer = () => {
    clearTimeout(currentTimer);
  };

  return { setGlobalTimeout, clearTimer };
})();

export const ExecutionTags = (() => {
  // @ts-ignore
  global.tags = [];

  const validateTag = (key, value, shouldLogErrors = true) => {
    key = String(key);
    value = String(value);
    if (key.length < 1 || key.length > MAX_TAG_KEY_LEN) {
      shouldLogErrors &&
        logger.warnClient(
          `${ADD_TAG_ERROR_MSG_PREFIX}: key length should be between 1 and ${MAX_TAG_KEY_LEN}: ${key} - ${value}`
        );
      return false;
    }
    if (value.length < 1 || value.length > MAX_TAG_VALUE_LEN) {
      shouldLogErrors &&
        logger.warnClient(
          `${ADD_TAG_ERROR_MSG_PREFIX}: value length should be between 1 and ${MAX_TAG_VALUE_LEN}: ${key} - ${value}`
        );
      return false;
    }
    // @ts-ignore
    if (global.tags.length >= MAX_TAGS) {
      shouldLogErrors &&
        logger.warnClient(
          `${ADD_TAG_ERROR_MSG_PREFIX}: maximum number of tags is ${MAX_TAGS}: ${key} - ${value}`
        );
      return false;
    }
    return true;
  };

  const normalizeTag = (val) => (val === undefined || val === null ? null : String(val));

  const addTag = (key, value, shouldLogErrors = true) => {
    try {
      if (isLambdaTraced()) {
        logger.debug(`Adding tag: ${key} - ${value}`);
        if (!validateTag(key, value, shouldLogErrors)) return false;
        // @ts-ignore
        global.tags.push({ key: normalizeTag(key), value: normalizeTag(value) });
      } else {
        shouldLogErrors && logger.warnClient(`${ADD_TAG_ERROR_MSG_PREFIX}: lambda is not traced`);
        return false;
      }
    } catch (err) {
      shouldLogErrors && logger.warnClient(ADD_TAG_ERROR_MSG_PREFIX);
      logger.warn(ADD_TAG_ERROR_MSG_PREFIX, err);
      return false;
    }
    return true;
  };

  // @ts-ignore
  const getTags = () => [...global.tags];

  // @ts-ignore
  const clear = () => (global.tags = []);

  const autoTagEvent = (event) => {
    getAutoTagKeys().forEach((key) => {
      const value = key.split('.').reduce((obj, innerKey) => obj && obj[innerKey], event);
      value && addTag(key, value);
    });
  };

  return { addTag, getTags, clear, validateTag, autoTagEvent };
})();

export const TracerGlobals = (() => {
  const handlerInputs: { event: {}; context: LambdaContext | {} } = {
    event: {},
    context: {},
  };

  const tracerInputs = {
    token: '',
    debug: false,
    edgeHost: '',
    switchOff: false,
    isStepFunction: false,
    maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
    lambdaTimeout: MAX_TRACER_ADDED_DURATION_ALLOWED,
  };

  const setHandlerInputs = ({ event, context }) => {
    Object.assign(tracerInputs, {
      lambdaTimeout: context.getRemainingTimeInMillis(),
    });
    return Object.assign(handlerInputs, {
      event,
      context,
    });
  };

  const getLambdaTimeout = () => tracerInputs.lambdaTimeout;

  const getHandlerInputs = (): { event: {}; context: LambdaContext | {} } => handlerInputs;

  const clearHandlerInputs = () => Object.assign(handlerInputs, { event: {}, context: {} });

  const setTracerInputs = ({
    token = '',
    debug = false,
    edgeHost = '',
    switchOff = false,
    stepFunction = false,
    maxSizeForRequest = null,
    lambdaTimeout = MAX_TRACER_ADDED_DURATION_ALLOWED,
  }: TracerOptions) =>
    Object.assign(tracerInputs, {
      token: token || process.env.LUMIGO_TRACER_TOKEN,
      debug: debug,
      edgeHost: edgeHost || process.env.LUMIGO_TRACER_HOST,
      switchOff: switchOff,
      lambdaTimeout: lambdaTimeout,
      isStepFunction:
        stepFunction ||
        !!(
          process.env['LUMIGO_STEP_FUNCTION'] &&
          process.env.LUMIGO_STEP_FUNCTION.toUpperCase() === 'TRUE'
        ),
      maxSizeForRequest:
        maxSizeForRequest ||
        (process.env['LUMIGO_MAX_SIZE_FOR_REQUEST']
          ? parseInt(process.env.LUMIGO_MAX_SIZE_FOR_REQUEST)
          : DEFAULT_MAX_SIZE_FOR_REQUEST),
    });

  const getTracerInputs = () => tracerInputs;

  const clearTracerInputs = () =>
    Object.assign(tracerInputs, {
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
      isStepFunction: false,
      maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
    });

  return {
    getTracerInputs,
    setTracerInputs,
    setHandlerInputs,
    getHandlerInputs,
    getLambdaTimeout,
    clearTracerInputs,
    clearHandlerInputs,
  };
})();

export const clearGlobals = () => {
  GlobalDurationTimer.reset();
  SpansContainer.clearSpans();
  TracerGlobals.clearHandlerInputs();
  GlobalTimer.clearTimer();
  ExecutionTags.clear();
};
