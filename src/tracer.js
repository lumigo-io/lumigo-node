import {
  isWarm,
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

const getSpanEnvironment = () => {};

const getStartSpan = (event, context, token) => {
  const info = getSpanInfo(event);
  const { transactionId } = info;
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

  const readiness = isWarm();

  if (!readiness) {
    setWarm();
  }

  const vendor = 'AWS';

  return {
    info,
    vendor,
    transactionId,
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

// XXX Promisify userHandler for non-async handlers?
export const trace = ({
  token,
  eventFilter,
  verbose,
  switchOff,
}) => userHandler => (event, context, callback) => {
  const ret = userHandler(event, context, callback);
  return ret;
};
