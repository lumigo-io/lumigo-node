import { isSwitchedOff, isAsyncFn } from './utils';
import { getFunctionSpan, getEndFunctionSpan } from './spans/aws_span';
import { sendSingleSpan, sendSpans } from './reporter';
import { TracerGlobals, SpansHive } from './globals';

export const startTrace = async () => {
  if (!isSwitchedOff()) {
    const functionSpan = getFunctionSpan();
    await sendSingleSpan(functionSpan);
    return functionSpan;
  } else {
    return {};
  }
};

export const endTrace = async (functionSpan, handlerReturnValue) => {
  if (!isSwitchedOff()) {
    const endFunctionSpan = getEndFunctionSpan(
      functionSpan,
      handlerReturnValue
    );
    SpansHive.addSpan(endFunctionSpan);

    const spans = SpansHive.getSpans();
    await sendSpans(spans);
  }
};

export const wrappedCallback = originalCallbackFn => (err, data) => {
  originalCallbackFn && originalCallbackFn(err, data);
};

// XXX Promisify userHandler for non-async handlers, and Promise.all with the Epilogue
export const trace = ({
  token,
  edgeHost,
  switchOff,
  eventFilter,
}) => userHandler => async (event, context, callback) => {
  TracerGlobals.setHandlerInputs({ event, context });
  TracerGlobals.setTracerInputs({ token, edgeHost, switchOff, eventFilter });

  const functionSpan = await startTrace();

  let handlerReturnValue = null;
  try {
    handlerReturnValue = await userHandler(
      event,
      context,
      wrappedCallback(callback)
    );
  } catch (e) {
    console.log('T', e);
    // XXX Remove Lumigo from stacktrace and throw.
  }

  await endTrace(functionSpan, handlerReturnValue);

  return handlerReturnValue;
};
