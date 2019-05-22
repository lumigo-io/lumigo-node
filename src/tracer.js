import { getFunctionSpan } from './spans/aws_span';

// XXX Promisify userHandler for non-async handlers?
export const trace = ({
  token,
  eventFilter,
  verbose,
  switchOff,
}) => userHandler => (event, context, callback) => {
  const functionSpan = getFunctionSpan(event, context, token);
  const ret = userHandler(event, context, callback);
  return ret;
};
