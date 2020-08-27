import * as logger from './logger';

const MAX_TAGS = 50;
const MAX_TAG_KEY_LEN = 50;
const MAX_TAG_VALUE_LEN = 50;
const ADD_TAG_ERROR_MSG_PREFIX = 'Skipping addExecutionTag: Unable to add tag';

export const SpansContainer = (() => {
  let spansToSend = {};

  const addSpan = span => {
    spansToSend[span.id] = span;
    logger.debug('Span created', span);
  };
  const getSpans = () => Object.values(spansToSend);
  const getSpanById = spanId => spansToSend[spanId];
  const changeSpanId = (oldId, newId) => {
    const oldSpan = spansToSend[oldId];
    if (oldSpan) {
      oldSpan.id = newId;
      spansToSend[newId] = oldSpan;
    }
    delete spansToSend[oldId];
  };
  const clearSpans = () => (spansToSend = {});

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
    if (global.tags.length >= MAX_TAGS) {
      shouldLogErrors &&
        logger.warnClient(
          `${ADD_TAG_ERROR_MSG_PREFIX}: maximum number of tags is ${MAX_TAGS}: ${key} - ${value}`
        );
      return false;
    }
    return true;
  };

  const addTag = (key, value, shouldLogErrors = true) => {
    try {
      logger.debug(`Adding tag: ${key} - ${value}`);
      if (!validateTag(key, value, shouldLogErrors)) return false;
      global.tags.push({ key, value });
    } catch (err) {
      shouldLogErrors && logger.warnClient(ADD_TAG_ERROR_MSG_PREFIX);
      logger.warn(ADD_TAG_ERROR_MSG_PREFIX, err);
      return false;
    }
    return true;
  };

  const getTags = () => [...global.tags];

  const clear = () => (global.tags = []);

  return { addTag, getTags, clear };
})();

export const TracerGlobals = (() => {
  const handlerInputs = { event: {}, context: {} };
  const tracerInputs = {
    token: '',
    debug: false,
    edgeHost: '',
    switchOff: false,
    isStepFunction: false,
  };

  const setHandlerInputs = ({ event, context }) => Object.assign(handlerInputs, { event, context });

  const getHandlerInputs = () => handlerInputs;

  const clearHandlerInputs = () => Object.assign(handlerInputs, { event: {}, context: {} });

  const setTracerInputs = ({
    token = '',
    debug = false,
    edgeHost = '',
    switchOff = false,
    stepFunction = false,
  }) =>
    Object.assign(tracerInputs, {
      token: token || process.env.LUMIGO_TRACER_TOKEN,
      debug: debug,
      edgeHost: edgeHost || process.env.LUMIGO_TRACER_HOST,
      switchOff: switchOff,
      isStepFunction:
        stepFunction ||
        !!(
          process.env['LUMIGO_STEP_FUNCTION'] &&
          process.env.LUMIGO_STEP_FUNCTION.toUpperCase() === 'TRUE'
        ),
    });

  const getTracerInputs = () => tracerInputs;

  const clearTracerInputs = () =>
    Object.assign(tracerInputs, {
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
      isStepFunction: false,
    });

  return {
    getTracerInputs,
    setTracerInputs,
    setHandlerInputs,
    getHandlerInputs,
    clearTracerInputs,
    clearHandlerInputs,
  };
})();

export const clearGlobals = () => {
  SpansContainer.clearSpans();
  TracerGlobals.clearTracerInputs();
  TracerGlobals.clearHandlerInputs();
  GlobalTimer.clearTimer();
  ExecutionTags.clear();
};
