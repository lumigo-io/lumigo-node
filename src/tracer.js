import { getStartSpan } from './spans/aws';

// XXX Promisify userHandler for non-async handlers?
export const trace = ({
  token,
  eventFilter,
  verbose,
  switchOff,
}) => userHandler => (event, context, callback) => {
  const startSpan = getStartSpan(event, context, token);
  console.log(JSON.stringify(startSpan, null, 2));
  const ret = userHandler(event, context, callback);
  return ret;
};
