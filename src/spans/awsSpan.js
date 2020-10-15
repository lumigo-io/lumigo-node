import {
  isWarm,
  setWarm,
  getTraceId,
  getAccountId,
  getTracerInfo,
  getContextInfo,
  getAWSEnvironment,
  isAwsService,
  parseErrorObject,
  shouldScrubDomain,
  getInvokedArn,
  getInvokedVersion,
  EXECUTION_TAGS_KEY,
  getEventEntitySize,
  safeGet,
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
import { payloadStringify, prune } from '../utils/payloadStringify';

export const HTTP_SPAN = 'http';
export const FUNCTION_SPAN = 'function';
export const EXTERNAL_SERVICE = 'external';
export const MONGO_SPAN = 'mongoDb';
export const REDIS_SPAN = 'redis';
export const PG_SPAN = 'pg';
export const MYSQL_SPAN = 'mySql';

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
  const { event: lambdaEvent, context: lambdaContext } = TracerGlobals.getHandlerInputs();
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

const getEventForSpan = (hasError = false) =>
  payloadStringify(
    parseEvent(TracerGlobals.getHandlerInputs().event),
    getEventEntitySize(hasError)
  );

const getEnvsForSpan = (hasError = false) =>
  payloadStringify(process.env, getEventEntitySize(hasError));

export const getFunctionSpan = () => {
  const { event: lambdaEvent, context: lambdaContext } = TracerGlobals.getHandlerInputs();

  const basicSpan = getBasicSpan();
  const info = { ...basicSpan.info, ...getEventInfo(lambdaEvent) };
  const type = FUNCTION_SPAN;

  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.

  // We need to keep sending them in the startSpan because we don't always have an endSpan
  const event = getEventForSpan();
  const envs = getEnvsForSpan();

  const { functionName: name, awsRequestId, remainingTimeInMillis } = getContextInfo(lambdaContext);

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
  let error = err ? parseErrorObject(err) : undefined;
  const ended = new Date().getTime();
  let return_value;
  try {
    return_value = payloadStringify(data);
  } catch (e) {
    return_value = prune(data.toString(), getEventEntitySize(true));
    error = parseErrorObject({
      name: 'ReturnValueError',
      message: `Could not JSON.stringify the return value. This will probably fail the lambda. Original error: ${e &&
        e.message}`,
    });
  }
  const event = error ? getEventForSpan(true) : functionSpan.event;
  const envs = error ? getEnvsForSpan(true) : functionSpan.envs;
  const newSpan = Object.assign({}, functionSpan, {
    id,
    ended,
    error,
    return_value,
    [EXECUTION_TAGS_KEY]: ExecutionTags.getTags(),
    event,
    envs,
  });
  logger.debug('End span created', newSpan);
  return newSpan;
};

export const AWS_PARSED_SERVICES = ['dynamodb', 'sns', 'lambda', 'sqs', 'kinesis'];

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
  const sizeLimit = getEventEntitySize(isErrorResponse(responseData));
  const { host } = requestData;
  try {
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
      request.headers = payloadStringify(request.headers, sizeLimit);
      request.body = payloadStringify(request.body, sizeLimit);

      if (response.headers) response.headers = payloadStringify(response.headers, sizeLimit);
      if (response.body) response.body = payloadStringify(response.body, sizeLimit);
    }

    return { host, request, response };
  } catch (e) {
    logger.warn('Failed to scrub & stringify http data', e.message);
    return {
      host,
      request: payloadStringify(requestData, sizeLimit),
      response: payloadStringify(responseData, sizeLimit),
    };
  }
};

export const getBasicChildSpan = (spanId, spanType) => {
  const { context } = TracerGlobals.getHandlerInputs();
  const { awsRequestId: parentId } = context;
  const id = spanId;
  const type = spanType;
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

const isErrorResponse = response => safeGet(response, ['statusCode'], 200) >= 400;

export const getHttpSpan = (randomRequestId, requestData, responseData = null) => {
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
  const httpInfo = getHttpInfo(requestData, responseData);

  const basicHttpSpan = getBasicChildSpan(prioritizedSpanId, HTTP_SPAN);

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
