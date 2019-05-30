import {
  SpanGlobals,
  getFunctionSpan,
  getEndFunctionSpan,
} from './spans/aws_span';
import { sendSingleSpan, sendSpans, SpansHive } from './reporter';

// XXX Promisify userHandler for non-async handlers, and Promise.all with the Epilogue
export const trace = ({ token, eventFilter }) => userHandler => async (
  event,
  context,
  callback
) => {
  SpanGlobals.set({ event, context, token });

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
  console.log(JSON.stringify(spans, null, 2));
  await sendSpans(spans);
  //console.log(JSON.stringify(SpansHive.getSpans(), null, 2));
  console.log('XXXX');
  return handlerReturnValue;
};
