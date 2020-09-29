import * as logger from '../logger';
import { getEnvVarAsList } from '../utils';

const API_GW_KEYS_ORDER = getEnvVarAsList('LUMIGO_API_GW_KEYS_ORDER', [
  'version',
  'routeKey',
  'rawPath',
  'rawQueryString',
  'resource',
  'path',
  'httpMethod',
  'queryStringParameters',
  'pathParameters',
  'body',
  'requestContext',
  'headers',
]);
const API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS = getEnvVarAsList(
  'LUMIGO_API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS',
  ['cookie', 'x-amz', 'accept', 'cloudfront', 'via', 'x-forwarded', 'sec-']
);
const API_GW_REQUEST_CONTEXT_FILTER_KEYS = getEnvVarAsList(
  'LUMIGO_API_GW_REQUEST_CONTEXT_FILTER_KEYS',
  ['authorizer', 'http']
);
const API_GW_KEYS_DELETE_KEYS = getEnvVarAsList('LUMIGO_API_GW_KEYS_DELETE_KEYS', [
  'multiValueHeaders',
  'multiValueQueryStringParameters',
]);
const SQS_KEYS_ORDER = getEnvVarAsList('LUMIGO_SQS_KEYS_ORDER', [
  'body',
  'messageAttributes',
  'messageId',
]);

const SNS_KEYS_ORDER = getEnvVarAsList('LUMIGO_SNS_KEYS_ORDER', [
  'Message',
  'MessageAttributes',
  'MessageId',
]);

const S3_KEYS_ORDER = getEnvVarAsList('LUMIGO_S3_KEYS_ORDER', [
  'awsRegion',
  'eventTime',
  'eventName',
  'userIdentity',
  'requestParameters',
]);

const S3_BUCKET_KEYS_ORDER = getEnvVarAsList('LUMIGO_S3_OBJECT_KEYS_ORDER', ['arn']);

const S3_OBJECT_KEYS_ORDER = getEnvVarAsList('LUMIGO_S3_OBJECT_KEYS_ORDER', ['key', 'size']);

const CLOUDFRONT_KEYS_ORDER = getEnvVarAsList('LUMIGO_CLOUDFRONT_KEYS_ORDER', ['config']);

const CLOUDFRONT_REQUEST_KEYS_ORDER = getEnvVarAsList('LUMIGO_CLOUDFRONT_REQUEST_KEYS_ORDER', [
  'body',
  'clientIp',
  'method',
  'querystring',
  'uri',
]);

export const isApiGwEvent = event => {
  return (
    event != null &&
    event.requestContext != null &&
    event.requestContext.domainName != null &&
    event.requestContext.requestId != null
  );
};

export const isSnsEvent = event => {
  return (
    event != null &&
    event.Records != null &&
    event.Records[0] != null &&
    event.Records[0].EventSource === 'aws:sns'
  );
};

export const isSqsEvent = event => {
  return (
    event != null &&
    event.Records != null &&
    event.Records[0] != null &&
    event.Records[0].eventSource === 'aws:sqs'
  );
};

export const isS3Event = event => {
  return (
    event != null &&
    event.Records != null &&
    event.Records[0] != null &&
    event.Records[0].eventSource === 'aws:s3'
  );
};

export const isCloudfrontEvent = event => {
  return (
    event != null &&
    event.Records != null &&
    event.Records[0] != null &&
    event.Records[0].cf != null &&
    event.Records[0].cf.config != null &&
    event.Records[0].cf.config.distributionId != null
  );
};

export const parseApiGwEvent = event => {
  const parsed_event = {};
  // Add order keys
  for (const order_key of API_GW_KEYS_ORDER) {
    if (event[order_key] != null) {
      parsed_event[order_key] = event[order_key];
    }
  }
  // Remove requestContext keys
  if (event.requestContext != null) {
    parsed_event['requestContext'] = {};
    for (const rc_key of Object.keys(event.requestContext)) {
      if (API_GW_REQUEST_CONTEXT_FILTER_KEYS.includes(rc_key.toLowerCase())) {
        parsed_event['requestContext'][rc_key] = event['requestContext'][rc_key];
      }
    }
  }
  // Remove headers keys
  if (event.headers != null) {
    parsed_event['headers'] = {};
    for (const h_key of Object.keys(event.headers)) {
      if (
        API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS.find(v => h_key.toLowerCase().startsWith(v)) == null
      ) {
        parsed_event['headers'][h_key] = event['headers'][h_key];
      }
    }
  }
  // Add all other keys
  for (const key of Object.keys(event)) {
    if (!API_GW_KEYS_ORDER.includes(key) && !API_GW_KEYS_DELETE_KEYS.includes(key)) {
      parsed_event[key] = event[key];
    }
  }
  return parsed_event;
};

export const parseSnsEvent = event => {
  const new_sns_event = {};
  new_sns_event['Records'] = [];
  // Add order keys
  for (const rec of event['Records']) {
    const new_sns_record_event = {};
    for (const key of SNS_KEYS_ORDER) {
      if (rec.Sns != null && rec.Sns[key] != null) {
        new_sns_record_event[key] = rec.Sns[key];
      }
    }
    new_sns_event['Records'].push({ Sns: new_sns_record_event });
  }
  return new_sns_event;
};

export const parseSqsEvent = event => {
  const new_sqs_event = {};
  new_sqs_event['Records'] = [];
  // Add order keys
  for (const rec of event['Records']) {
    const new_sqs_record_event = {};
    for (const key of SQS_KEYS_ORDER) {
      if (rec[key] != null) {
        new_sqs_record_event[key] = rec[key];
      }
    }
    new_sqs_event['Records'].push(new_sqs_record_event);
  }
  return new_sqs_event;
};

export const parseS3Event = event => {
  const new_s3_event = {};
  new_s3_event['Records'] = [];
  // Add order keys
  for (const rec of event['Records']) {
    const new_s3_record_event = {};
    for (const key of S3_KEYS_ORDER) {
      if (rec.hasOwnProperty(key) != null) {
        new_s3_record_event[key] = rec[key];
      }
    }
    if (rec.hasOwnProperty('s3')) {
      new_s3_record_event.s3 = {};
      if (rec.s3.hasOwnProperty('bucket')) {
        new_s3_record_event.s3.bucket = {};
        for (const key of S3_BUCKET_KEYS_ORDER) {
          new_s3_record_event.s3.bucket[key] = rec.s3.bucket[key];
        }
      }
      if (rec.s3.hasOwnProperty('object')) {
        new_s3_record_event.s3.object = {};
        for (const key of S3_OBJECT_KEYS_ORDER) {
          new_s3_record_event.s3.object[key] = rec.s3.object[key];
        }
      }
    }
    new_s3_event['Records'].push(new_s3_record_event);
  }
  return new_s3_event;
};

export const parseCloudfrontEvent = event => {
  const new_cloudfront_event = {};
  new_cloudfront_event['Records'] = [];
  // Add order keys
  for (const rec of event['Records']) {
    const cfRecord = rec['cf'] || {};
    const new_cloudfront_record_event = {};
    for (const key of CLOUDFRONT_KEYS_ORDER) {
      if (cfRecord.hasOwnProperty(key) != null) {
        new_cloudfront_record_event[key] = cfRecord[key];
      }
    }
    if (cfRecord.hasOwnProperty('request')) {
      new_cloudfront_record_event.request = {};
      for (const key of CLOUDFRONT_REQUEST_KEYS_ORDER) {
        if (cfRecord.request.hasOwnProperty(key)) {
          new_cloudfront_record_event.request[key] = cfRecord.request[key];
        }
      }
    }
    new_cloudfront_event['Records'].push(new_cloudfront_record_event);
  }
  return new_cloudfront_event;
};

export const parseEvent = event => {
  try {
    if (isApiGwEvent(event)) {
      return parseApiGwEvent(event);
    }
    if (isSnsEvent(event)) {
      return parseSnsEvent(event);
    }
    if (isSqsEvent(event)) {
      return parseSqsEvent(event);
    }
    if (isS3Event(event)) {
      return parseS3Event(event);
    }
    if (isCloudfrontEvent(event)) {
      return parseCloudfrontEvent(event);
    }
  } catch (e) {
    logger.warn('Failed to parse event', e);
  }
  return event;
};
