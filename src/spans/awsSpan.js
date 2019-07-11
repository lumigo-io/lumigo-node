import {
  isWarm,
  setWarm,
  pruneData,
  getTraceId,
  getRandomId,
  getTracerInfo,
  stringifyError,
  getContextInfo,
  getAWSEnvironment,
  stringifyAndPrune,
  isAwsService,
} from '../utils';
import { dynamodbParser, snsParser, lambdaParser } from '../parsers/aws';
import { getEventInfo } from '../events';
import { TracerGlobals } from '../globals';

export const HTTP_SPAN = 'http';
export const FUNCTION_SPAN = 'function';
export const EXTERNAL_SERVICE = 'external';

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
    event: lambdaEvent,
    context: lambdaContext,
  } = TracerGlobals.getHandlerInputs();
  const { token } = TracerGlobals.getTracerInputs();

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

  const vendor = 'AWS';
  const messageVersion = 2;
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
  const {
    event: lambdaEvent,
    context: lambdaContext,
  } = TracerGlobals.getHandlerInputs();

  const basicSpan = getBasicSpan();

  const type = FUNCTION_SPAN;

  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.

  const event = stringifyAndPrune(lambdaEvent);
  const envs = stringifyAndPrune(process.env);

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
  const { err, data } = handlerReturnValue;
  const id = removeStartedFromId(functionSpan.id);
  const error = err ? stringifyError(err) : undefined;
  const ended = new Date().getTime();
  const return_value = data ? pruneData(data) : null;
  return Object.assign({}, functionSpan, { id, ended, error, return_value });
};

export const AWS_PARSED_SERVICES = ['dynamodb', 'sns', 'lambda'];

export const getAwsServiceFromHost = host => {
  const service = host.split('.')[0];
  if (AWS_PARSED_SERVICES.includes(service)) {
    return service;
  }
  return EXTERNAL_SERVICE;
};
export const getServiceType = host =>
  isAwsService(host) ? getAwsServiceFromHost(host) : EXTERNAL_SERVICE;

export const getAwsServiceData = (requestData, responseData) => {
  const { host } = requestData;
  const awsService = getAwsServiceFromHost(host);

  switch (awsService) {
    case 'dynamodb':
      return dynamodbParser(requestData, responseData);
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

  const request = Object.assign({}, requestData);
  request.headers = stringifyAndPrune(request.headers);
  request.body = stringifyAndPrune(request.body);

  const response = Object.assign({}, responseData);
  response.headers = stringifyAndPrune(response.headers);
  response.body = stringifyAndPrune(response.body);

  return { host, request, response };
};

export const getBasicHttpSpan = (spanId = null) => {
  const { context } = TracerGlobals.getHandlerInputs();
  const { awsRequestId: parentId } = context;
  const id = spanId || getRandomId();
  const type = HTTP_SPAN;
  const basicSpan = getBasicSpan();
  return { ...basicSpan, id, type, parentId };
};

export const getHttpSpanTimings = (requestData, responseData) => {
  const { sendTime: started } = requestData;
  const { receivedTime: ended } = responseData;
  return { started, ended };
};

export const getHttpSpan = (requestData, responseData) => {
  const { host } = requestData;

  const { awsServiceData, spanId } = isAwsService(host)
    ? getAwsServiceData(requestData, responseData)
    : {};

  const httpInfo = getHttpInfo(requestData, responseData);

  const basicHttpSpan = getBasicHttpSpan(spanId);

  const info = Object.assign({}, basicHttpSpan.info, {
    httpInfo,
    ...awsServiceData,
  });

  const service = getServiceType(host);
  const { started, ended } = getHttpSpanTimings(requestData, responseData);

  return { ...basicHttpSpan, info, service, started, ended };
};

export const addRttToFunctionSpan = (functionSpan, rtt) =>
  Object.assign({}, functionSpan, { reporter_rtt: rtt });
