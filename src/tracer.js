import {
  getTracerId,
  getTracerInfo,
  getContextInfo,
  getAWSEnvironment,
} from './utils';
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

const getStartSpan = (event, context) => {
  const _info = getSpanInfo(event);
  const { functionName, awsRequestId, remainingTimeInMillis } = getContextInfo(
    context
  );
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
