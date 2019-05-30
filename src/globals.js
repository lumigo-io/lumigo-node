export const SpansHive = (() => {
  const spans = [];

  const addSpan = span => spans.push(span);
  const getSpans = () => spans;

  return { addSpan, getSpans };
})();

export const TracerGlobals = (() => {
  const handlerInputs = { event: {}, context: {} };
  const tracerInputs = { token: '', edgeHost: '', switchOff: false };

  const setHandlerInputs = ({ event, context }) =>
    Object.assign(handlerInputs, { event, context });

  const getHandlerInputs = () => handlerInputs;

  const setTracerInputs = ({ token, edgeHost, switchOff }) =>
    Object.assign(tracerInputs, { token, edgeHost, switchOff });

  const getTracerInputs = () => tracerInputs;

  return {
    getTracerInputs,
    setTracerInputs,
    setHandlerInputs,
    getHandlerInputs,
  };
})();
