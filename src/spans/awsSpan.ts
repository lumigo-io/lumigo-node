import { payloadStringify, scrub, ScrubContext } from '@lumigo/node-core';
import { Context } from 'aws-lambda';
import { getEventInfo } from '../events';
import { ExecutionTags, TracerGlobals } from '../globals';
import * as logger from '../logger';
import {
  apigwParser,
  defaultParser,
  dynamodbParser,
  eventBridgeParser,
  kinesisParser,
  lambdaParser,
  snsParser,
  sqsParser,
} from '../parsers/aws';
import { getSkipScrubPath, parseEvent } from '../parsers/eventParser';
import { BasicChildSpan, BasicSpan, SpanInfo } from '../types/spans/basicSpan';
import { FunctionSpan } from '../types/spans/functionSpan';
import { HttpInfo } from '../types/spans/httpSpan';
import {
  EXECUTION_TAGS_KEY,
  getAccountId,
  getAWSEnvironment,
  getContextInfo,
  getEventEntitySize,
  getInvokedArn,
  getInvokedVersion,
  getTraceId,
  getTracerInfo,
  INVOCATION_ID_KEY,
  isAwsService,
  isString,
  isWarm,
  parseErrorObject,
  safeExecute,
  SENDING_TIME_ID_KEY,
  setWarm,
  TRANSACTION_ID_KEY,
} from '../utils';
import { Utf8Utils } from '../utils/utf8Utils';

export const HTTP_SPAN = 'http';
export const FUNCTION_SPAN = 'function';
export const EXTERNAL_SERVICE = 'external';
export const MONGO_SPAN = 'mongoDb';
export const REDIS_SPAN = 'redis';
export const PG_SPAN = 'pg';
export const MSSQL_SPAN = 'msSql';
export const MYSQL_SPAN = 'mySql';
export const NEO4J_SPAN = 'neo4j';
export const ENRICHMENT_SPAN = 'enrichment';

export const getSpanInfo = (): SpanInfo => {
  const tracer = getTracerInfo();

  const {
    awsLambdaLogGroupName: logGroupName,
    awsLambdaLogStreamName: logStreamName,
    awsXAmznTraceId,
  } = getAWSEnvironment();

  const traceId = getTraceId(awsXAmznTraceId);

  return { traceId, tracer, logGroupName, logStreamName };
};

export const getCurrentTransactionId = (): string => {
  return getSpanInfo().traceId.transactionId;
};

export const isSpanIsFromAnotherInvocation = (span): boolean => {
  return (
    span.id &&
    !span.id.toString().includes(span.reporterAwsRequestId) &&
    span.parentId !== span.reporterAwsRequestId
  );
};

export const getBasicSpan = (id: string, transactionId: string): BasicSpan => {
  const { context: lambdaContext } = TracerGlobals.getHandlerInputs();
  const { token } = TracerGlobals.getTracerInputs();

  const info = getSpanInfo();

  // @ts-ignore
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
    id,
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

export const generateEnrichmentSpan = (
  executionTags: any[],
  token: string,
  transactionId: string,
  invocationId: string
) => {
  if (executionTags.length === 0) {
    return null;
  }
  const enrichmentSpan = {
    type: ENRICHMENT_SPAN,
    token: token,
    [TRANSACTION_ID_KEY]: transactionId,
    [INVOCATION_ID_KEY]: invocationId,
    [EXECUTION_TAGS_KEY]: executionTags,
    [SENDING_TIME_ID_KEY]: new Date().getTime(),
  };
  logger.debug('Enrichment span created', enrichmentSpan);
  return enrichmentSpan;
};

const getEventForSpan = (hasError = false): string => {
  const event = TracerGlobals.getHandlerInputs().event;
  return payloadStringify(
    safeExecute(parseEvent, 'Failed to parse event', logger.LOG_LEVELS.WARNING, event)(event),
    ScrubContext.DEFAULT,
    getEventEntitySize(hasError),
    getSkipScrubPath(event)
  );
};

export const getEnvsForSpan = (hasError = false): string =>
  payloadStringify(
    { ...process.env },
    ScrubContext.PROCESS_ENVIRONMENT,
    getEventEntitySize(hasError)
  );

export const getFunctionSpan = (lambdaEvent: {}, lambdaContext: Context): FunctionSpan => {
  const transactionId = getCurrentTransactionId();
  const { functionName: name, awsRequestId, remainingTimeInMillis } = getContextInfo(lambdaContext);
  const id = `${awsRequestId}_started`;
  const basicSpan = getBasicSpan(id, transactionId);
  const info = { ...basicSpan.info, ...getEventInfo(lambdaEvent) };
  const type = FUNCTION_SPAN;

  const started = new Date().getTime();
  const ended = started; // Indicates a StartSpan.

  // We need to keep sending them in the startSpan because we don't always have an endSpan
  const event = getEventForSpan();
  const envs = getEnvsForSpan();

  const maxFinishTime = started + remainingTimeInMillis;

  const startSpan = {
    ...basicSpan,
    info,
    envs,
    name,
    type,
    ended,
    event,
    started,
    maxFinishTime,
  };

  logger.debug('startTrace span created', startSpan);

  return startSpan;
};

export const removeStartedFromId = (id: string) => id.split('_')[0];

export const getEndFunctionSpan = (functionSpan, handlerReturnValue) => {
  const { err, data } = handlerReturnValue;
  const id = removeStartedFromId(functionSpan.id);
  const error = err ? parseErrorObject(err) : undefined;
  const ended = new Date().getTime();
  const returnValue = payloadStringify(data, ScrubContext.DEFAULT, getEventEntitySize(!!error));
  const event = error ? getEventForSpan(true) : functionSpan.event;
  const envs = error ? getEnvsForSpan(true) : functionSpan.envs;
  const newSpan = Object.assign({}, functionSpan, {
    id,
    ended,
    error,
    // eslint-disable-next-line camelcase
    return_value: returnValue,
    [EXECUTION_TAGS_KEY]: ExecutionTags.getTags(),
    event,
    envs,
  });
  logger.debug('End span created', newSpan);
  return newSpan;
};

export const AWS_PARSED_SERVICES = ['dynamodb', 'sns', 'lambda', 'sqs', 'kinesis', 'events'];

export const getAwsServiceFromHost = (host = '') => {
  const service = host.split('.')[0];
  if (AWS_PARSED_SERVICES.includes(service)) {
    return service;
  }

  if (host.includes('execute-api')) return 'apigw';

  return EXTERNAL_SERVICE;
};
export const getServiceType = (host) =>
  isAwsService(host) ? getAwsServiceFromHost(host) : EXTERNAL_SERVICE;

export type ServiceData = {
  awsServiceData?: {
    [key: string]: any;
  };
  messageId?: string;
  [key: string]: any;
};
export const getServiceData = (requestData, responseData): ServiceData => {
  const { host } = requestData;

  const awsService = getAwsServiceFromHost(host);

  switch (awsService) {
    case 'dynamodb':
      return dynamodbParser(requestData);
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
    case 'events':
      return eventBridgeParser(requestData, responseData);
    default:
      return defaultParser(requestData, responseData);
  }
};

export const decodeHttpBody = (httpBody: any, hasError: boolean): any | string => {
  if (isString(httpBody) && httpBody.length < getEventEntitySize(hasError)) {
    return Utf8Utils.safeDecode(httpBody);
  }
  return httpBody;
};

export const getHttpInfo = (requestData, responseData): HttpInfo => {
  const { host } = requestData;
  const request = Object.assign({}, requestData);
  const response = Object.assign({}, responseData);
  return { host, request, response };
};

export const getBasicChildSpan = (
  transactionId: string,
  awsRequestId: string,
  spanId: string,
  spanType: string
): BasicChildSpan => {
  const { context } = TracerGlobals.getHandlerInputs();
  // @ts-ignore
  const { awsRequestId: reporterAwsRequestId } = context;
  const basicSpan = getBasicSpan(spanId, transactionId);
  return { ...basicSpan, id: spanId, type: spanType, parentId: awsRequestId, reporterAwsRequestId };
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
  transactionId,
  awsRequestId,
  randomRequestId,
  requestData,
  responseData = { truncated: false, body: undefined, headers: undefined }
) => {
  let serviceData = {};
  try {
    if (isAwsService(requestData.host, responseData)) {
      serviceData = getServiceData(requestData, responseData);
    }
  } catch (e) {
    logger.warn('Failed to parse aws service data', e);
    logger.warn('getHttpSpan args', { requestData, responseData });
  }
  // @ts-ignore
  const { awsServiceData, spanId } = serviceData;

  const prioritizedSpanId = getHttpSpanId(randomRequestId, spanId);
  if (requestData?.body) {
    requestData.body = scrub(requestData.body, ScrubContext.HTTP_REQUEST_BODY);
  }
  if (requestData?.headers) {
    requestData.headers = scrub(requestData.headers, ScrubContext.HTTP_REQUEST_HEADERS);
  }
  if (responseData?.body) {
    responseData.body = scrub(responseData.body, ScrubContext.HTTP_RESPONSE_BODY);
  }
  if (responseData?.headers) {
    responseData.headers = scrub(responseData.headers, ScrubContext.HTTP_RESPONSE_HEADERS);
  }
  const httpInfo = getHttpInfo(requestData, responseData);

  const basicHttpSpan = getBasicChildSpan(
    transactionId,
    awsRequestId,
    prioritizedSpanId,
    HTTP_SPAN
  );

  const info = Object.assign({}, basicHttpSpan.info, {
    httpInfo,
    ...awsServiceData,
  });

  let service = EXTERNAL_SERVICE;
  try {
    service = getServiceType(requestData.host);
  } catch (e) {
    logger.warn('Failed to get service type', e);
  }

  const { started, ended } = getHttpSpanTimings(requestData, responseData);

  return { ...basicHttpSpan, info, service, started, ended };
};
