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

const getStartSpan = (event, context, token) => {
  const info = getSpanInfo(event);
  const { functionName, awsRequestId, remainingTimeInMillis } = getContextInfo(
    context
  );
  const id = `${awsRequestId}_started`;
  const name = functionName;
  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.
  const { awsRegion: region, awsExecutionEnv: runtime } = getAWSEnvironment();
  const type = 'function';
  const maxFinishTime = started + remainingTimeInMillis;
  const messageVersion = 2;
  const readiness = 'warm'; //XXX

  return {
    info,
    readiness,
    messageVersion,
    token,
    id,
    name,
    started,
    ended,
    region,
    type,
    maxFinishTime,
  };
};

const beforeUserHandler = () => {
  const awsEnv = getAWSEnvironment();
  console.log(awsEnv);
};

export const trace = ({
  token,
  eventFilter,
  verbose,
  switchOff,
}) => userHandler => (event, context, callback) => {
  const ret = userHandler(event, context, callback);
  return ret;
};
