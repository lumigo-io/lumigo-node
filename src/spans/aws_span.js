import {
  isWarm,
  setWarm,
  pruneData,
  getTraceId,
  isVerboseMode,
  getTracerInfo,
  getContextInfo,
  getAWSEnvironment,
  stringifyAndPrune,
} from '../utils';
import { getEventInfo } from '../events';

export const getSpanInfo = event => {
  const tracer = getTracerInfo();
  const {
    awsLambdaLogGroupName: logGroupName,
    awsLambdaLogStreamName: logStreamName,
    awsXAmznTraceId,
  } = getAWSEnvironment();
  const traceId = getTraceId(awsXAmznTraceId);
  const eventInfo = getEventInfo(event);
  return { traceId, tracer, logGroupName, logStreamName, ...eventInfo };
};

export const getFunctionSpan = (lambdaEvent, lambdaContext, token) => {
  const info = getSpanInfo(lambdaEvent);
  const { traceId } = info;
  const { transactionId } = traceId;

  const {
    functionName,
    awsRequestId,
    awsAccountId,
    remainingTimeInMillis,
  } = getContextInfo(lambdaContext);

  const {
    awsRegion: region,
    awsExecutionEnv: runtime,
    awsLambdaFunctionMemorySize: memoryAllocated,
    awsLambdaFunctionVersion: version,
  } = getAWSEnvironment();

  const id = `${awsRequestId}_started`;
  const name = functionName;
  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.
  const type = 'function';
  const messageVersion = 2;
  const vendor = 'AWS';
  const account = awsAccountId;
  const maxFinishTime = started + remainingTimeInMillis;

  const readiness = isWarm() ? 'warm' : 'cold';
  if (readiness === 'warm') {
    setWarm();
  }

  const event = isVerboseMode() ? stringifyAndPrune(event) : null;
  const envs = isVerboseMode() ? stringifyAndPrune(process.env) : null;

  return {
    info,
    vendor,
    transactionId,
    account,
    memoryAllocated,
    version,
    runtime,
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
    event,
    envs,
  };
};

export const removeStartedFromId = id => id.split('_')[0];

export const getEndFunctionSpan = (functionSpan, handlerReturnValue) => {
  const id = removeStartedFromId(functionSpan.id);
  const ended = new Date().getTime();
  const return_value = isVerboseMode() ? pruneData(handlerReturnValue) : null;
  return Object.assign({}, functionSpan, { id, ended, return_value });
};
