import { getTracerId, getTracerInfo, getAWSEnvironment } from './utils';

const getStartSpan = () => {
  const tracer = getTracerInfo();
  const traceId = getTraceId();
  const {
    awsLambdaLogGroupName: logGroupName,
    awsLambdaLogStreamName: logStreamName,
  } = getAWSEnvironment();
  const _info = { traceId, tracer, logGroupName, logStreamName };
};

const beforeUserHandler = () => {
  const awsEnv = getAWSEnvironment();
  console.log(awsEnv);
};

export const trace = (token, eventFilter) => userHandler => (
  event,
  context,
  callback
) => {
  const ret = userHandler(event, context, callback);
  return ret;
};
