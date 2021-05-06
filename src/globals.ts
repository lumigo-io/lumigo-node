import * as logger from './logger';
import { Context } from 'aws-lambda';
const MAX_TAGS = 50;
const MAX_TAG_KEY_LEN = 50;
const MAX_TAG_VALUE_LEN = 50;
const ADD_TAG_ERROR_MSG_PREFIX = 'Skipping addExecutionTag: Unable to add tag';
export const DEFAULT_MAX_SIZE_FOR_REQUEST = 1000 * 1000;

export const Timer = (() => {
  let time = 0;

  type CockState = 'stopped' | 'idle' | 'counting';

  let state: CockState = 'stopped';
  let startTime = 0;
  let _duration = 0;

  // since utils uses globals had to duplicate function
  const runOneTimeWrapper = (func: Function, context: any): Function => {
    let done = false;
    return (...args) => {
      if (!done) {
        const result = func.apply(context || this, args);
        done = true;
        return result;
      }
    };
  };

  const warnTimeout = runOneTimeWrapper(() => {
    logger.warnClient('Lumigo tracer reached its timeout and will no longer collect data');
  }, {});

  const init = (duration) => {
    time = 0;
    startTime = 0;
    state = 'idle';
    _duration = duration;
  };

  const start = () => {
    if (state === 'stopped') {
      init(process.env.LUMIGO_TRACER_TIMEOUT || 500);
    }
    if (state === 'idle') {
      startTime = new Date().getTime();
      state = 'counting';
    }
  };

  const pause = () => {
    if (state === 'counting') {
      time += new Date().getTime() - startTime;
      state = 'idle';
    }
  };

  const isTimePassed = () => {
    let res: boolean;
    if (state === 'counting') {
      let now = new Date().getTime();
      res = time + (now - startTime) > _duration;
    } else {
      res = time > _duration;
    }
    if (res) {
      warnTimeout();
    }
    return res;
  };

  const getState = () => {
    return state;
  };

  const getTime = () => {
    if (state === 'counting') return time + new Date().getTime() - startTime;
    else return time;
  };

  const stop = () => {
    time = 0;
    startTime = 0;
    state = 'stopped';
  };

  const timedAsync = () => {
    // eslint-disable-next-line no-undef
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        start();
        const result = await originalMethod.apply(this, args);
        pause();
        return result;
      };

      return descriptor;
    };
  };

  const timedSync = () => {
    // eslint-disable-next-line no-undef
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = function (...args: any[]) {
        start();
        const result = originalMethod.apply(this, args);
        pause();
        return result;
      };

      return descriptor;
    };
  };
  return { timedSync, timedAsync, stop, getTime, getState, isTimePassed, pause, start, init };
})();

export const SpansContainer = (() => {
  let spansToSend = {};

  const addSpan = (span) => {
    spansToSend[span.id] = span;
    logger.debug('Span created', span);
  };
  const getSpans = () => Object.values(spansToSend);
  const getSpanById = (spanId) => spansToSend[spanId];
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
      logger.debug(`Adding tag: ${key} - ${value}`);
      if (!validateTag(key, value, shouldLogErrors)) return false;
      // @ts-ignore
      global.tags.push({ key: normalizeTag(key), value: normalizeTag(value) });
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

  return { addTag, getTags, clear, validateTag };
})();

export const TracerGlobals = (() => {
  const handlerInputs: { event: {}; context: Context | {} } = {
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
  };

  const setHandlerInputs = ({ event, context }) => Object.assign(handlerInputs, { event, context });

  const getHandlerInputs = (): { event: {}; context: Context | {} } => handlerInputs;

  const clearHandlerInputs = () => Object.assign(handlerInputs, { event: {}, context: {} });

  const setTracerInputs = ({
    token = '',
    debug = false,
    edgeHost = '',
    switchOff = false,
    stepFunction = false,
    maxSizeForRequest = null,
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
    clearTracerInputs,
    clearHandlerInputs,
  };
})();

export const clearGlobals = () => {
  Timer.stop();
  SpansContainer.clearSpans();
  TracerGlobals.clearHandlerInputs();
  GlobalTimer.clearTimer();
  ExecutionTags.clear();
};
