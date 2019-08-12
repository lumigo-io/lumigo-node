import { debug } from './logger';

export const SpansContainer = (() => {
  const allSpans = [];
  const spansToSend = [];

  const addSpan = span => {
    allSpans.push(span);
    spansToSend.push(span);
    debug('Span created', span);
  };
  const getSpans = () => allSpans;
  const clearSpans = () => {allSpans.length = 0; spansToSend.length = 0};
  const getSpansToSend = () => spansToSend;
  const clearSpansToSend = () => (spansToSend.length = 0);

  return { addSpan, getSpans, clearSpans, getSpansToSend, clearSpansToSend };
})();

export const TracerGlobals = (() => {
  const handlerInputs = { event: {}, context: {} };
  const tracerInputs = {
    token: '',
    debug: false,
    edgeHost: '',
    switchOff: false,
  };
  let timeoutTimer = undefined;

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
  }) => Object.assign(tracerInputs, { token, debug, edgeHost, switchOff });

  const getTracerInputs = () => tracerInputs;

  const clearTracerInputs = () =>
    Object.assign(tracerInputs, {
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
    });

  return {
    timeoutTimer,
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
