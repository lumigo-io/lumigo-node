import {
  isWarm,
  getTraceId,
  getTracerInfo,
  getContextInfo,
  getAWSEnvironment,
  stringifyAndPrune,
} from './utils';
import { getEventInfo } from './events';

const getSpanInfo = event => {
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

const getStartSpan = (lambdaEvent, lambdaContext, token) => {
  const _info = getSpanInfo(lambdaEvent);
  const { transactionId: _transactionId } = _info;

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
  const x = 'asdf';
  const _id = `${awsRequestId}_started`;
  const type = 'asdf';
  const _name = functionName;
  const _started = new Date().getTime();
  const _ended = _started; // Indicates a StartSpan.
  const _type = 'function';
  const _messageVersion = 2;
  const _vendor = 'AWS';
  const _account = awsAccountId;
  const maxFinishTime = _started + remainingTimeInMillis;

  const _readiness = isWarm();
  if (!_readiness) {
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
  const startSpan = getStartSpan(event, context);
  console.log(JSON.stringify(startSpan, null, 2));
  const ret = userHandler(event, context, callback);
  return ret;
};
