import type {
  APIGatewayEvent,
  APIGatewayProxyEventV2,
  CloudFrontRequestEvent,
  CloudFrontRequestEventRecord,
  DynamoDBStreamEvent,
  S3Event,
  S3EventRecord,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda';

import * as logger from '../logger';
import { getEnvVarAsList, isScrubKnownServicesOn } from '../utils';
import {
  isApiGwEvent,
  isCloudfrontEvent,
  isDDBEvent,
  isS3Event,
  isSnsEvent,
  isSqsEvent,
} from './eventChecker';

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
  ['authorizer', 'http', 'requestid']
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

export const parseApiGwEvent = (event) => {
  const parsedEvent = {};
  // Add order keys
  for (const orderKey of API_GW_KEYS_ORDER) {
    if (event[orderKey] != null) {
      parsedEvent[orderKey] = event[orderKey];
    }
  }
  // Remove requestContext keys
  if (event.requestContext != null) {
    parsedEvent['requestContext'] = {};
    for (const rcKey of Object.keys(event.requestContext)) {
      if (API_GW_REQUEST_CONTEXT_FILTER_KEYS.includes(rcKey.toLowerCase())) {
        parsedEvent['requestContext'][rcKey] = event['requestContext'][rcKey];
      }
    }
  }
  // Remove headers keys
  if (event.headers != null) {
    parsedEvent['headers'] = {};
    for (const hKey of Object.keys(event.headers)) {
      if (
        API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS.find((v) => hKey.toLowerCase().startsWith(v)) == null
      ) {
        parsedEvent['headers'][hKey] = event['headers'][hKey];
      }
    }
  }
  // Add all other keys
  for (const key of Object.keys(event)) {
    if (!API_GW_KEYS_ORDER.includes(key) && !API_GW_KEYS_DELETE_KEYS.includes(key)) {
      parsedEvent[key] = event[key];
    }
  }
  return parsedEvent;
};

export const parseSnsEvent = (event) => {
  const newSnsEvent = {};
  newSnsEvent['Records'] = [];
  // Add order keys
  for (const rec of event['Records']) {
    const newSnsRecordEvent = {};
    for (const key of SNS_KEYS_ORDER) {
      if (rec.Sns != null && rec.Sns[key] != null) {
        newSnsRecordEvent[key] = rec.Sns[key];
      }
    }
    newSnsEvent['Records'].push({ Sns: newSnsRecordEvent });
  }
  return newSnsEvent;
};

export const parseSqsEvent = (event) => {
  const newSqsEvent = {};
  newSqsEvent['Records'] = [];
  // Add order keys
  for (const rec of event['Records']) {
    const newSqsRecordEvent = {};
    for (const key of SQS_KEYS_ORDER) {
      if (rec?.[key] != null) {
        newSqsRecordEvent[key] = rec[key];
      }
    }
    newSqsEvent['Records'].push(newSqsRecordEvent);
  }
  return newSqsEvent;
};

export const parseS3Event = (event: S3Event) => {
  const newS3Event: S3Event = {
    Records: [],
  };

  // Add order keys
  for (const rec of event['Records']) {
    const newS3RecordEvent: S3EventRecord = {} as S3EventRecord;

    for (const key of S3_KEYS_ORDER) {
      if (rec?.[key] !== undefined) {
        newS3RecordEvent[key] = rec[key];
      }
    }

    if (rec?.s3?.bucket !== undefined) {
      newS3RecordEvent.s3 = {
        bucket: {},
        object: {},
      } as S3EventRecord['s3'];

      for (const key of S3_OBJECT_KEYS_ORDER) {
        newS3RecordEvent.s3.object[key] = rec.s3.object[key];
      }

      for (const key of S3_BUCKET_KEYS_ORDER) {
        newS3RecordEvent.s3.bucket[key] = rec.s3.bucket[key];
      }
    }

    newS3Event['Records'].push(newS3RecordEvent);
  }

  return newS3Event;
};

export const parseCloudfrontEvent = (event: CloudFrontRequestEvent) => {
  const newCloudfrontEvent: CloudFrontRequestEvent = {
    Records: [],
  };

  // Add order keys
  for (const rec of event['Records']) {
    const cfRecord = rec['cf'] || ({} as CloudFrontRequestEventRecord['cf']);
    const newCloudfrontRecordEvent = { cf: {} } as CloudFrontRequestEvent['Records'][0];

    for (const key of CLOUDFRONT_KEYS_ORDER) {
      if (cfRecord?.[key] !== undefined) {
        newCloudfrontRecordEvent.cf[key] = cfRecord[key];
      }
    }

    if (cfRecord?.request !== undefined) {
      newCloudfrontRecordEvent.cf.request = {} as CloudFrontRequestEventRecord['cf']['request'];

      for (const key of CLOUDFRONT_REQUEST_KEYS_ORDER) {
        if (cfRecord.request?.[key] !== undefined) {
          newCloudfrontRecordEvent.cf.request[key] = cfRecord.request[key];
        }
      }
    }

    newCloudfrontEvent['Records'].push(newCloudfrontRecordEvent);
  }

  return newCloudfrontEvent;
};

export const func = (input) => {
  try {
    func2(input);
  } catch (e) {
    console.log('err');
  }
};

export const func2 = (input) => {
  if (input === 1) return input;
};

export const parseEvent = (event) => {
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

export const getSkipScrubPath = (event) => {
  if (isScrubKnownServicesOn()) {
    return null;
  }
  if (isS3Event(event)) {
    return ['Records', [], 's3', 'object', 'key'];
  }
  if (isDDBEvent(event)) {
    return ['Records', [], 'dynamodb', 'Keys'];
  }
  return null;
};
