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

const FUNCTION_SPAN = 'function';
const HTTP_SPAN = 'http';

export const SpanGlobals = (() => {
  const globals = { event: {}, context: {}, token: '' };
  const set = (name, value) => (globals[name] = value);
  const get = () => globals;

  return { set, get };
})();

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

export const getBasicSpan = (lambdaEvent, lambdaContext, token) => {
  const info = getSpanInfo(lambdaEvent);
  const { traceId } = info;
  const { transactionId } = traceId;

  const { awsAccountId } = getContextInfo(lambdaContext);

  const {
    awsRegion: region,
    awsExecutionEnv: runtime,
    awsLambdaFunctionMemorySize: memoryAllocated,
    awsLambdaFunctionVersion: version,
  } = getAWSEnvironment();

  const messageVersion = 2;
  const vendor = 'AWS';
  const account = awsAccountId;

  const readiness = isWarm() ? 'warm' : 'cold';
  if (readiness === 'warm') {
    setWarm();
  }

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
    region,
  };
};

export const getFunctionSpan = (lambdaEvent, lambdaContext, token) => {
  const basicSpan = getBasicSpan(lambdaEvent, lambdaContext, token);

  const type = FUNCTION_SPAN;

  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.

  const event = isVerboseMode() ? stringifyAndPrune(lambdaEvent) : null;
  const envs = isVerboseMode() ? stringifyAndPrune(process.env) : null;

  const {
    functionName: name,
    awsRequestId,
    remainingTimeInMillis,
  } = getContextInfo(lambdaContext);

  const id = `${awsRequestId}_started`;
  const maxFinishTime = started + remainingTimeInMillis;

  return {
    ...basicSpan,
    id,
    envs,
    name,
    type,
    ended,
    event,
    started,
    maxFinishTime,
  };
};

export const removeStartedFromId = id => id.split('_')[0];

export const getEndFunctionSpan = (functionSpan, handlerReturnValue) => {
  const id = removeStartedFromId(functionSpan.id);
  const ended = new Date().getTime();
  const return_value = isVerboseMode() ? pruneData(handlerReturnValue) : null;
  return Object.assign({}, functionSpan, { id, ended, return_value });
};

export const getHttpSpan = () => {};
