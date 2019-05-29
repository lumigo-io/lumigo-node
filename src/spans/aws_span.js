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
import { dynamodbParser, snsParser, lambdaParser } from '../parsers/aws';
import { getEventInfo } from '../events';
import uuidv1 from 'uuid/v1';

const FUNCTION_SPAN = 'function';
const HTTP_SPAN = 'http';

export const SpanGlobals = (() => {
  const globals = { event: {}, context: {}, token: '' };

  const set = ({ event, context, token }) =>
    Object.assign(globals, { event, context, token });

  const get = () => globals;
  const clear = () =>
    Object.assign(globals, { event: {}, context: {}, token: '' });

  return { set, get, clear };
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

export const getBasicSpan = () => {
  const {
    token,
    event: lambdaEvent,
    context: lambdaContext,
  } = SpanGlobals.get();

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

export const getFunctionSpan = () => {
  const { event: lambdaEvent, context: lambdaContext } = SpanGlobals.get();

  const basicSpan = getBasicSpan();

  const type = FUNCTION_SPAN;

  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.

  const event = isVerboseMode() ? stringifyAndPrune(lambdaEvent) : null;
  const envs = ''; //isVerboseMode() ? stringifyAndPrune(process.env) : null;

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

export const isRequestToAwsService = host =>
  !!(host && host.includes('amazonaws.com'));

export const AWS_PARSED_SERVICES = ['dynamodb', 'sns', 'lambda'];

export const getAwsServiceFromHost = host => {
  const service = host.split('.')[0];
  if (AWS_PARSED_SERVICES.includes(service)) {
    return service;
  }
};

export const getAwsServiceData = (requestData, responseData) => {
  const { host } = requestData;
  const awsService = getAwsServiceFromHost(host);

  switch (awsService) {
    case 'dynamodb':
      return dynamodbParser(requestData);
    case 'sns':
      return snsParser(requestData, responseData);
    case 'lambda':
      return lambdaParser(requestData, responseData);
    default:
      return {};
  }
};

export const getHttpInfo = (requestData, responseData) => {
  const { host } = requestData;
  return { host, request: requestData, response: responseData };
};

export const getBasicHttpSpan = () => {
  const { context } = SpanGlobals.get();
  const { awsRequestId: parentId } = context;
  const id = uuidv1();
  const type = HTTP_SPAN;
  const basicSpan = getBasicSpan();
  return { ...basicSpan, id, type, parentId };
};

export const getHttpSpan = (requestData, responseData) => {
  const httpInfo = getHttpInfo(requestData, responseData);

  const { host } = requestData;
  const awsServiceData = isRequestToAwsService(host)
    ? getAwsServiceData(requestData, responseData)
    : {};

  const basicHttpSpan = getBasicHttpSpan();

  const info = Object.assign({}, basicHttpSpan.info, {
    httpInfo,
    ...awsServiceData,
  });

  return { ...basicHttpSpan, info };
};

export const addResponseDataToHttpSpan = (responseData, httpSpan) => {
  const newHttpSpan = Object.assign({}, httpSpan);
  newHttpSpan.info.httpInfo.response = responseData;
  return newHttpSpan;
};
