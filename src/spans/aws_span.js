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
  const _info = getSpanInfo(lambdaEvent);
  const { traceId } = _info;
  const { transactionId: _transactionId } = traceId;

  const {
    functionName,
    awsRequestId,
    awsAccountId,
    remainingTimeInMillis,
  } = getContextInfo(lambdaContext);

  const {
    awsRegion: _region,
    awsExecutionEnv: _runtime,
    awsLambdaFunctionMemorySize: _memoryAllocated,
    awsLambdaFunctionVersion: _version,
  } = getAWSEnvironment();

  const _id = `${awsRequestId}_started`;
  const _name = functionName;
  const _token = token;
  const _started = new Date().getTime();
  const _ended = _started; // Indicates a StartSpan.
  const _type = 'function';
  const _messageVersion = 2;
  const _vendor = 'AWS';
  const _account = awsAccountId;
  const maxFinishTime = _started + remainingTimeInMillis;

  const _readiness = isWarm() ? 'warm' : 'cold';
  if (_readiness === 'warm') {
    setWarm();
  }

  const event = isVerboseMode() ? stringifyAndPrune(event) : null;
  const envs = isVerboseMode() ? stringifyAndPrune(process.env) : null;

  return {
    _info,
    _vendor,
    _transactionId,
    _account,
    _memoryAllocated,
    _version,
    _runtime,
    _readiness,
    _messageVersion,
    _token,
    _id,
    _name,
    _started,
    _ended,
    _region,
    _type,
    maxFinishTime,
    event,
    envs,
  };
};

export const removeStartedFromId = id => id.split('_')[0];

export const getEndFunctionSpan = (functionSpan, handlerReturnValue) => {
  const _id = removeStartedFromId(functionSpan._id);
  const _ended = new Date().getTime();
  const return_value = isVerboseMode() ? pruneData(handlerReturnValue) : null;
  return Object.assign({}, functionSpan, { _id, _ended, return_value });
};
