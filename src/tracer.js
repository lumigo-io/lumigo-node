import {
  SpanGlobals,
  getFunctionSpan,
  getEndFunctionSpan,
} from './spans/aws_span';
import { sendSingleSpan, SpansHive } from './reporter';

// XXX Promisify userHandler for non-async handlers, and Promise.all with the Epilogue
export const trace = ({
  token,
  eventFilter,
  verbose,
  switchOff,
}) => userHandler => async (event, context, callback) => {
  SpanGlobals.set({ event, context, token });

  const functionSpan = getFunctionSpan();
  SpansHive.addSpan(functionSpan);
  //await sendSingleSpan(functionSpan);
  let handlerReturnValue = null;

  try {
    handlerReturnValue = await userHandler(event, context, callback);
  } catch (e) {
    console.log('T', e.message);
  }

  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
  SpansHive.addSpan(endFunctionSpan);
  //await sendSingleSpan(endFunctionSpan);
  console.log(JSON.stringify(SpansHive.getSpans(), null, 2));

  return handlerReturnValue;
};
