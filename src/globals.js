import { debug } from './logger';

export const SpansContainer = (() => {
  const spansToSend = [];

  const addSpan = span => {
    spansToSend.push(span);
    debug('Span created', span);
  };
  const getSpans = () => spansToSend;
  const clearSpans = () => (spansToSend.length = 0);

  return { addSpan, getSpans, clearSpans };
})();

export const TracerGlobals = (() => {
  const handlerInputs = { event: {}, context: {} };
  const tracerInputs = {
    token: '',
    debug: false,
    edgeHost: '',
    switchOff: false,
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
    });

  const getTracerInputs = () => tracerInputs;

  const clearTracerInputs = () =>
    Object.assign(tracerInputs, {
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
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
};
