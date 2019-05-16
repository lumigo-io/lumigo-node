import { getTracerId, getTracerInfo, getAWSEnvironment } from './utils';
import { getEventInfo } from './events';

const getSpanInfo = event => {
  const tracer = getTracerInfo();
  const traceId = getTraceId();
  const {
    awsLambdaLogGroupName: logGroupName,
    awsLambdaLogStreamName: logStreamName,
  } = getAWSEnvironment();
  const eventInfo = getEventInfo(event);
  return { traceId, tracer, logGroupName, logStreamName, ...eventInfo };
};

const getStartSpan = event => {
  const _info = getSpanInfo(event);
  return { _info };
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
