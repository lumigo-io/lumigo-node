import { debug } from './logger';

export const SpansContainer = (() => {
  let spansToSend = {};

  const addSpan = span => {
    spansToSend[span.id] = span;
    debug('Span created', span);
  };
  const getSpans = () => Object.values(spansToSend);
  const clearSpans = () => (spansToSend = {});

  return { addSpan, getSpans, clearSpans };
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

export const TracerGlobals = (() => {
  const handlerInputs = { event: {}, context: {} };
  const tracerInputs = {
    token: '',
    debug: false,
    edgeHost: '',
    switchOff: false,
    isStepFunction: false,
  };

  const setHandlerInputs = ({ event, context }) =>
    Object.assign(handlerInputs, { event, context });

  const getHandlerInputs = () => handlerInputs;

  const clearHandlerInputs = () =>
    Object.assign(handlerInputs, { event: {}, context: {} });

  const setTracerInputs = ({
    token = '',
    debug = false,
    edgeHost = '',
    switchOff = false,
    stepFunction = false,
  }) =>
    Object.assign(tracerInputs, {
      token: token || process.env.LUMIGO_TRACER_TOKEN,
      debug:
        debug ||
        !!(
          process.env['LUMIGO_DEBUG'] &&
          process.env.LUMIGO_DEBUG.toUpperCase() === 'TRUE'
        ),
      edgeHost: edgeHost || process.env.LUMIGO_TRACER_HOST,
      switchOff:
        switchOff ||
        !!(
          process.env['LUMIGO_SWITCH_OFF'] &&
          process.env.LUMIGO_SWITCH_OFF === 'TRUE'
        ),
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
};
