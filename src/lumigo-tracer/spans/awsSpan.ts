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
import { BasicChildSpan, BasicSpan, GenericSpan, SpanInfo } from '../types/spans/basicSpan';
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
  isAwsService,
  isString,
  isWarm,
  parseErrorObject,
  safeExecute,
  setWarm,
  spanHasErrors,
} from '../utils';
import { payloadStringify, shallowMask, truncate } from '../utils/payloadStringify';
import { Utf8Utils } from '../utils/utf8Utils';
import { getW3CMessageId } from '../utils/w3cUtils';
import { RequestData, ResponseData } from '../hooks/baseHttp';
import { anonymizeData } from '../tracer/tracer';

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
export const PRISMA_SPAN = 'prisma';

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

export const getSpanPriority = (span): number => {
  if (span.type === FUNCTION_SPAN) {
    return 0;
  }
  if (span.type === ENRICHMENT_SPAN) {
    return 1;
  }
  if (spanHasErrors(span)) {
    return 2;
  }
  return 3;
};

export const spansPrioritySorter = (span1: any, span2: any): number => {
  return Math.sign(getSpanPriority(span1) - getSpanPriority(span2));
};

export const getSpanMetadata = (span: GenericSpan): GenericSpan => {
  const spanCopy = JSON.parse(JSON.stringify(span));
  spanCopy['isMetadata'] = true;

  if (spanCopy.type === FUNCTION_SPAN) {
    delete spanCopy?.envs;
    return spanCopy;
  } else if (spanCopy.type === ENRICHMENT_SPAN) {
    delete spanCopy?.[EXECUTION_TAGS_KEY];
    return spanCopy;
  } else if (spanCopy.type === HTTP_SPAN) {
    delete spanCopy?.info?.httpInfo?.request?.headers;
    delete spanCopy?.info?.httpInfo?.request?.body;
    delete spanCopy?.info?.httpInfo?.response?.headers;
    delete spanCopy?.info?.httpInfo?.response?.body;
    return spanCopy;
  } else if (spanCopy.type === MONGO_SPAN) {
    delete spanCopy?.request;
    delete spanCopy?.response;
    return spanCopy;
  } else if (spanCopy.type === REDIS_SPAN) {
    delete spanCopy?.requestArgs;
    delete spanCopy?.response;
    return spanCopy;
  } else if (spanCopy.type === NEO4J_SPAN) {
    delete spanCopy?.summary;
    delete spanCopy?.query;
    delete spanCopy?.values;
    delete spanCopy?.response;
    return spanCopy;
  } else if (
    spanCopy.type === PG_SPAN ||
    spanCopy.type === MYSQL_SPAN ||
    spanCopy.type === MSSQL_SPAN
  ) {
    delete spanCopy?.query;
    delete spanCopy?.values;
    delete spanCopy?.response;
    return spanCopy;
  } else if (spanCopy.type === PRISMA_SPAN) {
    delete spanCopy?.queryArgs;
    delete spanCopy?.result;
    return spanCopy;
  }
  logger.warn(`Got unknown span type: ${spanCopy.type}`);
  return spanCopy;
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

const getEventForSpan = (hasError: boolean = false): string => {
  const event = TracerGlobals.getHandlerInputs().event;
  return payloadStringify(
    safeExecute(parseEvent, 'Failed to parse event', logger.LOG_LEVELS.WARNING, event)(event),
    getEventEntitySize(hasError),
    getSkipScrubPath(event)
  );
};

export const getEnvsForSpan = (hasError: boolean = false): string =>
  payloadStringify(shallowMask('environment', process.env), getEventEntitySize(hasError));

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

export const removeStartedFromId = (id) => id.split('_')[0];

export const getEndFunctionSpan = (functionSpan: GenericSpan, handlerReturnValue): GenericSpan => {
  const { err, data } = handlerReturnValue;
  const id = removeStartedFromId(functionSpan.id);
  let error = err ? parseErrorObject(err) : undefined;
  const ended = new Date().getTime();
  let returnValue: any;
  try {
    returnValue = payloadStringify(data);
  } catch (e) {
    returnValue = truncate(data.toString(), getEventEntitySize(true));
    error = parseErrorObject({
      name: 'ReturnValueError',
      message: `Could not JSON.stringify the return value. This will probably fail the lambda. Original error: ${
        e && e.message
      }`,
    });
  }
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

export const getHttpInfo = (requestData: RequestData, responseData): HttpInfo => {
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
  requestData: RequestData,
  responseData: ResponseData = { truncated: false, body: undefined, headers: undefined }
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
  if (requestData) {
    // Check if HTTP anonymization is enabled (defaults to true if LUMIGO_ANONYMIZE_ENABLED is true)
    const httpAnonymizeEnabled = process.env['LUMIGO_ANONYMIZE_ENABLED'] === 'true' && 
                                 process.env['LUMIGO_ANONYMIZE_HTTP_ENABLED'] !== 'false';
    
    // Apply anonymization before masking
    if (httpAnonymizeEnabled) {
      try {
        // Anonymize request body - handle JSON parsing and anonymization
        console.log('🔍 BEFORE ANONYMIZATION - Request body:', {
          type: typeof requestData.body,
          length: requestData.body?.length,
          preview: requestData.body?.substring(0, 100) + '...'
        });
        
        if (requestData.body && typeof requestData.body === 'string') {
          try {
            // Only try to parse if it looks like JSON (starts with { or [)
            if (requestData.body.trim().startsWith('{') || requestData.body.trim().startsWith('[')) {
              const parsedBody = JSON.parse(requestData.body);
              const anonymizedBody = anonymizeData(parsedBody);
              // Keep as object, don't re-stringify
              requestData.body = anonymizedBody;
              console.log('🔍 AFTER JSON ANONYMIZATION - Request body:', {
                type: typeof requestData.body,
                isObject: typeof requestData.body === 'object',
                preview: JSON.stringify(requestData.body).substring(0, 100) + '...'
              });
            } else {
              // Not JSON, treat as regular string
              requestData.body = anonymizeData(requestData.body);
              console.log('🔍 AFTER STRING ANONYMIZATION - Request body:', {
                type: typeof requestData.body,
                length: requestData.body?.length,
                preview: requestData.body?.substring(0, 100) + '...'
              });
            }
          } catch (e) {
            // If parsing fails, treat as regular string
            requestData.body = anonymizeData(requestData.body);
            console.log('🔍 AFTER STRING ANONYMIZATION (parse failed) - Request body:', {
              type: typeof requestData.body,
              length: requestData.body?.length,
              preview: requestData.body?.substring(0, 100) + '...'
            });
          }
        } else {
          // Already an object or null/undefined
          requestData.body = anonymizeData(requestData.body);
          console.log('🔍 AFTER OBJECT ANONYMIZATION - Request body:', {
            type: typeof requestData.body,
            isObject: typeof requestData.body === 'object',
            preview: requestData.body ? JSON.stringify(requestData.body).substring(0, 100) + '...' : 'null/undefined'
          });
        }
        
        logger.debug('🔒 HTTP ANONYMIZATION: Request body anonymized successfully');
        // Anonymize request headers
        requestData.headers = anonymizeData(requestData.headers);
        logger.debug('🔒 HTTP ANONYMIZATION: Request headers anonymized successfully');
      } catch (error) {
        logger.warn('Failed to anonymize request data', error);
      }
    } else {
      // Apply shallowMask when HTTP anonymization is disabled
      requestData.body && (requestData.body = shallowMask('requestBody', requestData.body));
      requestData.headers &&
        (requestData.headers = shallowMask('requestHeaders', requestData.headers));
    }
  }
  if (responseData) {
    // Check if HTTP anonymization is enabled (defaults to true if LUMIGO_ANONYMIZE_ENABLED is true)
    const httpAnonymizeEnabled = process.env['LUMIGO_ANONYMIZE_ENABLED'] === 'true' && 
                                 process.env['LUMIGO_ANONYMIZE_HTTP_ENABLED'] !== 'false';
    
    // Apply anonymization before masking
    if (httpAnonymizeEnabled) {
      try {
        // Anonymize response body - handle JSON parsing and anonymization
        if (responseData.body && typeof responseData.body === 'string') {
          try {
            // Only try to parse if it looks like JSON (starts with { or [)
            if (responseData.body.trim().startsWith('{') || responseData.body.trim().startsWith('[')) {
              const parsedBody = JSON.parse(responseData.body);
              const anonymizedBody = anonymizeData(parsedBody);
              // Keep as object, don't re-stringify
              responseData.body = anonymizedBody;
            } else {
              // Not JSON, treat as regular string
              responseData.body = anonymizeData(responseData.body);
            }
          } catch (e) {
            // If parsing fails, treat as regular string
            responseData.body = anonymizeData(responseData.body);
          }
        } else {
          // Already an object or null/undefined
          responseData.body = anonymizeData(responseData.body);
        }
        logger.debug('🔒 HTTP ANONYMIZATION: Response body anonymized successfully');
        // Anonymize response headers
        responseData.headers = anonymizeData(responseData.headers);
        logger.debug('🔒 HTTP ANONYMIZATION: Response headers anonymized successfully');
      } catch (error) {
        logger.warn('Failed to anonymize response data', error);
      }
    } else {
      // Apply shallowMask when HTTP anonymization is disabled
      responseData.body && (responseData.body = shallowMask('responseBody', responseData.body));
      responseData.headers &&
        (responseData.headers = shallowMask('responseHeaders', responseData.headers));
    }
  }
  const httpInfo = getHttpInfo(requestData, responseData);

  const basicHttpSpan = getBasicChildSpan(
    transactionId,
    awsRequestId,
    prioritizedSpanId,
    HTTP_SPAN
  );

  const info = Object.assign({}, basicHttpSpan.info, { httpInfo }, awsServiceData);

  // add messageId based on W3cContextPropagation in case of messageId not present
  if (!info.messageId) {
    info.messageId = getW3CMessageId(requestData.headers);
  }

  let service = EXTERNAL_SERVICE;
  try {
    service = getServiceType(requestData.host);
  } catch (e) {
    logger.warn('Failed to get service type', e);
  }

  const { started, ended } = getHttpSpanTimings(requestData, responseData);

  return { ...basicHttpSpan, info, service, started, ended };
};
