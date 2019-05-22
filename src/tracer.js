import { getFunctionSpan, getEndFunctionSpan } from './spans/aws_span';

// XXX Promisify userHandler for non-async handlers?
export const trace = ({
  token,
  eventFilter,
  verbose,
  switchOff,
}) => userHandler => (event, context, callback) => {
  const functionSpan = getFunctionSpan(event, context, token);
  const handlerReturnValue = userHandler(event, context, callback);
  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
  return ret;
};
