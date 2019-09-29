import {
  isWarm,
  setWarm,
  pruneData,
  getTraceId,
  getRandomId,
  getAccountId,
  getTracerInfo,
  getContextInfo,
  getAWSEnvironment,
  stringifyAndPrune,
  isAwsService,
  parseErrorObject,
  omitKeys,
} from '../utils';
import {
  dynamodbParser,
  snsParser,
  lambdaParser,
  sqsParser,
  kinesisParser,
  awsParser,
} from '../parsers/aws';
import { TracerGlobals } from '../globals';
import { getEventInfo } from '../events';

export const HTTP_SPAN = 'http';
export const FUNCTION_SPAN = 'function';
export const EXTERNAL_SERVICE = 'external';

export const getSpanInfo = () => {
  const tracer = getTracerInfo();

  const {
    awsLambdaLogGroupName: logGroupName,
    awsLambdaLogStreamName: logStreamName,
    awsXAmznTraceId,
  } = getAWSEnvironment();

  const traceId = getTraceId(awsXAmznTraceId);

  return { traceId, tracer, logGroupName, logStreamName };
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

  const awsAccountId = getAccountId(lambdaContext);

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
  if (readiness === 'cold') {
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
  const info = { ...basicSpan.info, ...getEventInfo(lambdaEvent) };
  const type = FUNCTION_SPAN;

  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.

  const event = stringifyAndPrune(omitKeys(lambdaEvent));
  const envs = stringifyAndPrune(omitKeys(process.env));

  const {
    functionName: name,
    awsRequestId,
    remainingTimeInMillis,
  } = getContextInfo(lambdaContext);

  const id = `${awsRequestId}_started`;
  const maxFinishTime = started + remainingTimeInMillis;

  return {
    ...basicSpan,
    info,
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
  const error = err ? parseErrorObject(err) : undefined;
  const ended = new Date().getTime();
  const return_value = data ? pruneData(omitKeys(data)) : null;
  return Object.assign({}, functionSpan, { id, ended, error, return_value });
};

export const AWS_PARSED_SERVICES = [
  'dynamodb',
  'sns',
  'lambda',
  'sqs',
  'kinesis',
];

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
    case 'sqs':
      return sqsParser(requestData, responseData);
    case 'kinesis':
      return kinesisParser(requestData, responseData);
    default:
      return awsParser(requestData, responseData);
  }
};

export const getHttpInfo = (requestData, responseData) => {
  const { host } = requestData;

  const request = Object.assign({}, requestData);
  request.headers = stringifyAndPrune(omitKeys(request.headers));
  request.body = stringifyAndPrune(omitKeys(request.body));

  const response = Object.assign({}, responseData);
  response.headers = stringifyAndPrune(omitKeys(response.headers));
  response.body = stringifyAndPrune(omitKeys(response.body));

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

  const { awsServiceData, spanId } = isAwsService(host, responseData)
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
