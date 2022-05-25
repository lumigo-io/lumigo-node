import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  AppSyncResolverEvent,
  DynamoDBStreamEvent,
  EventBridgeEvent,
  KinesisStreamEvent,
  S3Event,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda';

import {
  isStepFunction,
  LUMIGO_EVENT_KEY,
  md5Hash,
  recursiveGetKey,
  safeExecute,
  STEP_FUNCTION_UID_KEY,
} from '../utils';
import type {
  ApiGatewayV1EventData,
  ApiGatewayV2EventData,
  AppSyncEventData,
  DynamoDBStreamEventData,
  EventBridgeEventData,
  EventData,
  EventInfo,
  IncomingEvent,
  IncomingEventRecord,
  KinesisStreamEventData,
  S3EventData,
  SNSEventData,
  SQSEventData,
  StepFunctionEventData,
} from './event-data.types';
import { EventTrigger } from './event-trigger.enum';

export const getTriggeredBy = (event: IncomingEvent): EventTrigger => {
  const canDetectTriggerSourceFromEventRecords =
    event?.['Records']?.[0]?.['eventSource'] || event?.['Records']?.[0]?.['EventSource'];

  if (canDetectTriggerSourceFromEventRecords) {
    return extractEventSourceFromRecord(event['Records'][0]);
  }

  if (isApiGatewayEvent(event)) {
    return EventTrigger.ApiGateway;
  }

  if (isAppSyncEvent(event)) {
    return EventTrigger.AppSync;
  }

  if (isStepFunction() && event != null && !!recursiveGetKey(event, LUMIGO_EVENT_KEY)) {
    return EventTrigger.StepFunction;
  }

  if (isEventBridgeEvent(event)) {
    return EventTrigger.EventBridge;
  }

  return EventTrigger.Invocation;
};

const extractEventSourceFromRecord = (eventRecord: IncomingEventRecord): EventTrigger => {
  const { eventSource, EventSource } = eventRecord || {};
  const eventSourceStr = eventSource || EventSource;

  // AWS EventSources are formatted as "aws:$EVENT_SOURCE_NAME"
  // See https://github.com/aws/aws-lambda-go/tree/master/events/testdata
  // eslint-disable-next-line
  const [_, eventSourceName] = eventSourceStr.split(':');

  return eventSourceName;
};

export const isApiGatewayEvent = (
  event: IncomingEvent
): event is APIGatewayProxyEvent | APIGatewayProxyEventV2 => {
  return (
    (event?.['httpMethod'] && event?.['requestContext']?.['stage']) ||
    (event?.['headers'] && event?.['version'] === '2.0' && event?.['requestContext']?.['stage'])
  );
};

export const isAppSyncEvent = (event: IncomingEvent): event is AppSyncResolverEvent<any> => {
  return event?.request?.headers?.host?.includes('appsync-api');
};

export const isEventBridgeEvent = (event: IncomingEvent): event is EventBridgeEvent<any, any> => {
  return (
    typeof event?.version === 'string' &&
    typeof event?.id === 'string' &&
    typeof event?.['detail-type'] === 'string' &&
    typeof event?.source === 'string' &&
    typeof event?.time === 'string' &&
    typeof event?.region === 'string' &&
    Array.isArray(event?.resources) &&
    typeof event?.detail === 'object'
  );
};

export const getRelevantEventData = (triggeredBy: EventTrigger, event): EventData => {
  switch (triggeredBy) {
    case EventTrigger.SQS:
      return getSqsData(event);
    case EventTrigger.DynamoDB:
      return getDynamodbData(event);
    case EventTrigger.Kinesis:
      return getKinesisData(event);
    case EventTrigger.SNS:
      return getSnsData(event);
    case EventTrigger.S3:
      return getS3Data(event);
    case EventTrigger.ApiGateway:
      return getApiGatewayData(event);
    case EventTrigger.EventBridge:
      return getEventBridgeData(event);
    case EventTrigger.AppSync:
      return getAppSyncData(event);
    case EventTrigger.StepFunction:
      return getStepFunctionData(event);
    case EventTrigger.Invocation:
    default:
      return {};
  }
};

export const getSqsData = (event: SQSEvent): SQSEventData => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = event.Records.map((r) => r.messageId).filter((messageId) => messageId != null);

  if (messageIds.length === 1) return { arn, messageId: messageIds[0] };

  return { arn, messageIds };
};

export const getDynamodbData = (event: DynamoDBStreamEvent): DynamoDBStreamEventData => {
  const arn = event.Records[0].eventSourceARN;
  const approxEventCreationTime = event.Records[0].dynamodb.ApproximateCreationDateTime * 1000;
  const messageIds = event.Records.map((record) => {
    if (['MODIFY', 'REMOVE'].includes(record.eventName) && record?.dynamodb?.Keys) {
      return md5Hash(record.dynamodb.Keys);
    } else if (record.eventName === 'INSERT' && record.dynamodb && record.dynamodb.NewImage) {
      return md5Hash(record.dynamodb.NewImage);
    }
  }).filter((hashedRecordContent) => hashedRecordContent != null);

  return { arn, messageIds, approxEventCreationTime };
};

export const getKinesisData = (event: KinesisStreamEvent): KinesisStreamEventData => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = (event.Records || [])
    .map((record) => record.kinesis.sequenceNumber)
    .filter((recordSequenceNumber) => recordSequenceNumber != null);

  return { arn, messageIds };
};

export const getSnsData = (event: SNSEvent): SNSEventData => {
  const { TopicArn: arn, MessageId: messageId } = event.Records[0].Sns;

  return { arn, messageId };
};

export const getS3Data = (event: S3Event): S3EventData => {
  return { arn: event.Records[0].s3.bucket.arn };
};

export const getApiGatewayData = (event: APIGatewayProxyEvent | APIGatewayProxyEventV2) => {
  const version = event?.['version'];

  if (version === '2.0') {
    return getApiGatewayV2Data(event as APIGatewayProxyEventV2);
  }

  return getApiGatewayV1Data(event as APIGatewayProxyEvent);
};

const getApiGatewayV1Data = (event: APIGatewayProxyEvent): ApiGatewayV1EventData => {
  const { headers, resource, httpMethod, requestContext } = event;
  const { stage } = requestContext;

  const api = headers?.Host || null;
  const messageId = requestContext.requestId;

  return { messageId, httpMethod, resource, stage, api };
};

const getApiGatewayV2Data = (event: APIGatewayProxyEventV2): ApiGatewayV2EventData => {
  const httpMethod = event.requestContext.http.method;
  const resource = event.requestContext.http.path;
  const messageId = event.requestContext.requestId;
  const api = event.requestContext.domainName;
  const stage = event.requestContext.stage || 'unknown';

  return { httpMethod, resource, messageId, api, stage };
};

export const getEventBridgeData = (event: EventBridgeEvent<any, any>): EventBridgeEventData => {
  return { messageId: event.id };
};

export const getAppSyncData = (event: AppSyncResolverEvent<any>): AppSyncEventData => {
  const { host, 'x-amzn-trace-id': traceId } = event.request.headers;

  return {
    api: host,
    messageId: traceId.split('=')[1],
  };
};

export const getStepFunctionData = (event): StepFunctionEventData => {
  return {
    messageId: recursiveGetKey(event, LUMIGO_EVENT_KEY)[STEP_FUNCTION_UID_KEY],
  };
};

export const getEventInfo = (event: IncomingEvent): EventInfo => {
  const triggeredBy = getTriggeredBy(event);
  const eventData = safeExecute(() => getRelevantEventData(triggeredBy, event))();

  return { ...eventData, triggeredBy };
};
