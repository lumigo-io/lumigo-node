import { getFunctionSpan, getEndFunctionSpan } from './spans/aws_span';
import { sendSingleSpan, sendSpans } from './reporter';
import { TracerGlobals, SpansHive } from './globals';

// XXX Promisify userHandler for non-async handlers, and Promise.all with the Epilogue
export const trace = ({
  token,
  edgeHost,
  eventFilter,
}) => userHandler => async (event, context, callback) => {
  TracerGlobals.setHandlerInputs({ event, context });
  TracerGlobals.setTracerInputs({ token, edgeHost, eventFilter });

  const functionSpan = getFunctionSpan();
  await sendSingleSpan(functionSpan);
  let handlerReturnValue = null;

  try {
    handlerReturnValue = await userHandler(event, context, callback);
  } catch (e) {
    console.log('T', e.message);
  }

  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
  SpansHive.addSpan(endFunctionSpan);

  const spans = SpansHive.getSpans();
  await sendSpans(spans);

  return handlerReturnValue;
};
