import {
  isWarm,
  setWarm,
  pruneData,
  getTraceId,
  getAccountId,
  getTracerInfo,
  getContextInfo,
  getAWSEnvironment,
  stringifyAndPrune,
  isAwsService,
  parseErrorObject,
  getEventEntitySize,
  shouldScrubDomain,
  getInvokedArn,
  getInvokedVersion,
  EXECUTION_TAGS_KEY,
} from '../utils';
import {
  dynamodbParser,
  snsParser,
  lambdaParser,
  sqsParser,
  kinesisParser,
  awsParser,
  apigwParser,
} from '../parsers/aws';
import { TracerGlobals, ExecutionTags } from '../globals';
import { getEventInfo } from '../events';
import { parseEvent } from '../parsers/eventParser';
import * as logger from '../logger';

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

export const getCurrentTransactionId = () => {
  const { event: lambdaEvent } = TracerGlobals.getHandlerInputs();
  return getSpanInfo(lambdaEvent).traceId.transactionId;
};

export const getBasicSpan = () => {
  const {
    event: lambdaEvent,
    context: lambdaContext,
  } = TracerGlobals.getHandlerInputs();
  const { token } = TracerGlobals.getTracerInputs();

  const info = getSpanInfo(lambdaEvent);
  const transactionId = getCurrentTransactionId();

  const awsAccountId = getAccountId(lambdaContext);
  const invokedArn = getInvokedArn();
  const invokedVersion = getInvokedVersion();

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
    invokedArn,
    invokedVersion,
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

  const event = stringifyAndPrune(
    parseEvent(lambdaEvent),
    getEventEntitySize()
  );
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
  const return_value = data ? pruneData(data) : null;
  const newSpan = Object.assign({}, functionSpan, {
    id,
    ended,
    error,
    return_value,
    [EXECUTION_TAGS_KEY]: ExecutionTags.getTags(),
  });
  logger.debug('End span created', newSpan);
  return newSpan;
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

  if (host.includes('execute-api')) return 'apigw';

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
    case 'apigw':
      return apigwParser(requestData, responseData);
    default:
      return awsParser(requestData, responseData);
  }
};

export const getHttpInfo = (requestData, responseData) => {
  const { host } = requestData;

  const request = Object.assign({}, requestData);
  const response = Object.assign({}, responseData);

  if (
    shouldScrubDomain(host) ||
    (request.host && shouldScrubDomain(request.host)) ||
    (response.host && shouldScrubDomain(response.host))
  ) {
    request.body = 'The data is not available';
    response.body = 'The data is not available';
    delete request.headers;
    delete response.headers;
    delete request.uri;
  } else {
    request.headers = stringifyAndPrune(request.headers);
    request.body = stringifyAndPrune(request.body);

    if (response.headers)
      response.headers = stringifyAndPrune(response.headers);
    if (response.body) response.body = stringifyAndPrune(response.body);
  }

  return { host, request, response };
};

export const getBasicHttpSpan = spanId => {
  const { context } = TracerGlobals.getHandlerInputs();
  const { awsRequestId: parentId } = context;
  const id = spanId;
  const type = HTTP_SPAN;
  const basicSpan = getBasicSpan();
  return { ...basicSpan, id, type, parentId };
};

export const getHttpSpanTimings = (requestData, responseData) => {
  const { sendTime: started } = requestData;
  const { receivedTime: ended } = responseData || {};
  return { started, ended };
};

export const getHttpSpanId = (randomRequestId, awsRequestId = null) => {
  return awsRequestId ? awsRequestId : randomRequestId;
};

export const getHttpSpan = (
  randomRequestId,
  requestData,
  responseData = null
) => {
  let serviceData = {};
  try {
    if (isAwsService(requestData.host, responseData)) {
      serviceData = getAwsServiceData(requestData, responseData);
    }
  } catch (e) {
    logger.warn('Failed to parse aws service data', e.message);
  }
  const { awsServiceData, spanId } = serviceData;

  const prioritizedSpanId = getHttpSpanId(randomRequestId, spanId);
  let httpInfo = {
    host: requestData.host,
    request: requestData,
    response: responseData,
  };
  try {
    httpInfo = getHttpInfo(requestData, responseData);
  } catch (e) {
    logger.warn('Failed to scrub & stringify http data', e.message);
  }

  const basicHttpSpan = getBasicHttpSpan(prioritizedSpanId);

  const info = Object.assign({}, basicHttpSpan.info, {
    httpInfo,
    ...awsServiceData,
  });

  let service = EXTERNAL_SERVICE;
  try {
    service = getServiceType(requestData.host);
  } catch (e) {
    logger.warn('Failed to get service type', e.message);
  }

  const { started, ended } = getHttpSpanTimings(requestData, responseData);

  return { ...basicHttpSpan, info, service, started, ended };
};

export const addRttToFunctionSpan = (functionSpan, rtt) =>
  Object.assign({}, functionSpan, { reporter_rtt: rtt });
