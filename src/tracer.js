import { getFunctionSpan, getEndFunctionSpan } from './spans/aws_span';
import { sendSingleSpan } from './reporter';

// XXX Promisify userHandler for non-async handlers, and Promise.all with the Epilogue
export const trace = ({
  token,
  eventFilter,
  verbose,
  switchOff,
}) => userHandler => async (event, context, callback) => {
  const functionSpan = getFunctionSpan(event, context, token);
  //await sendSingleSpan(functionSpan);

  const handlerReturnValue = await userHandler(event, context, callback);

  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
  //await sendSingleSpan(endFunctionSpan);

  return handlerReturnValue;
};
