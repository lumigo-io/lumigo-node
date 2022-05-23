import {
  isStepFunction,
  LUMIGO_EVENT_KEY,
  md5Hash,
  recursiveGetKey,
  safeExecute,
  STEP_FUNCTION_UID_KEY,
} from '../utils';
import { EventTrigger } from './types';
import { EventBridgeEvent } from 'aws-lambda';

export const getTriggeredBy = (event): EventTrigger => {
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

  if (isStepFunction() && event && !!recursiveGetKey(event, LUMIGO_EVENT_KEY)) {
    return EventTrigger.StepFunction;
  }

  if (isEventBridgeEvent(event)) {
    return EventTrigger.EventBridge;
  }

  // TODO: maybe rename to unknown?
  return EventTrigger.Invocation;
};

const extractEventSourceFromRecord = (eventRecord) => {
  const { eventSource, EventSource } = eventRecord;
  const eventSourceStr = eventSource || EventSource;

  // AWS EventSources are formatted as "aws:$EVENT_SOURCE_NAME"
  // See https://github.com/aws/aws-lambda-go/tree/master/events/testdata
  // eslint-disable-next-line
  const [_, eventSourceName] = eventSourceStr.split(':');

  return eventSourceName;
};

export const isApiGatewayEvent = (event) => {
  return (
    (event?.['httpMethod'] && event?.['requestContext']?.['stage']) ||
    (event?.['headers'] && event?.['version'] === '2.0' && event?.['requestContext']?.['stage'])
  );
};

export const isAppSyncEvent = (event) => {
  return (
    (event?.['context']?.['request']?.['headers']?.['host']?.includes('appsync-api')) ||
    (event?.['request']?.['headers']?.['host']?.includes('appsync-api'))
  );
};

export const isEventBridgeEvent = (event): event is EventBridgeEvent<any, any> => {
  return (
    typeof event !== undefined &&
    typeof event.version === 'string' &&
    typeof event.id === 'string' &&
    typeof event['detail-type'] === 'string' &&
    typeof event.source === 'string' &&
    typeof event.time === 'string' &&
    typeof event.region === 'string' &&
    Array.isArray(event.resources) &&
    typeof event.detail === 'object'
  );
};

const getApiGatewayV1Data = (event) => {
  const { headers = {}, resource, httpMethod, requestContext = {} } = event;
  const { stage = null } = requestContext;

  const api = headers['Host'] || null;
  const messageId = requestContext['requestId'];

  return { messageId, httpMethod, resource, stage, api };
};

const getApiGatewayV2Data = (event) => {
  const httpMethod = ((event['requestContext'] || {})['http'] || {})['method'];
  const resource = ((event['requestContext'] || {})['http'] || {})['path'];
  const messageId = (event['requestContext'] || {})['requestId'];
  const api = (event['requestContext'] || {})['domainName'];
  const stage = (event['requestContext'] || {})['stage'] || 'unknown';

  return { httpMethod, resource, messageId, api, stage };
};

export const getApiGatewayData = (event) => {
  const version = event?.['version'];

  if (version === '2.0') {
    return getApiGatewayV2Data(event);
  }

  return getApiGatewayV1Data(event);
};

export const getAppSyncData = (event) => {
  if (event.context) {
    const { host, 'x-amzn-trace-id': traceId } = event.context.request.headers;

    return { api: host, messageId: traceId.split('=')[1] };
  } else {
    const { host, 'x-amzn-trace-id': traceId } = event.request.headers;

    return { api: host, messageId: traceId.split('=')[1] };
  }
};

export const getSnsData = (event) => {
  const { TopicArn: arn, MessageId: messageId } = event.Records[0].Sns;

  return { arn, messageId };
};

export const getKinesisData = (event) => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = (event.Records || [])
    .map((record) => record?.['kinesis']?.['sequenceNumber'])
    .filter((recordSequenceNumber) => recordSequenceNumber != null);

  return { arn, messageIds };
};

export const getSqsData = (event) => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = (event.Records || []).map((r) => r['messageId']).filter((x) => !!x);

  if (messageIds.length === 1) return { arn, messageId: messageIds[0] };

  return { arn, messageIds };
};

export const getDynamodbData = (event) => {
  const arn = event.Records[0].eventSourceARN;
  const approxEventCreationTime = event.Records[0].dynamodb.ApproximateCreationDateTime * 1000;
  const messageIds = (event.Records || [])
    .map((record) => {
      if (
        ['MODIFY', 'REMOVE'].includes(record.eventName) &&
        record?.dynamodb?.Keys
      ) {
        return md5Hash(record.dynamodb.Keys);
      } else if (record.eventName === 'INSERT' && record.dynamodb && record.dynamodb.NewImage) {
        return md5Hash(record.dynamodb.NewImage);
      }
    })
    .filter((hashedRecordContent) => hashedRecordContent!= null);

  return { arn, messageIds, approxEventCreationTime };
};

export const getRelevantEventData = (triggeredBy: EventTrigger, event) => {
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
      return { arn: event.Records[0].s3.bucket.arn };
    case EventTrigger.ApiGateway:
      return getApiGatewayData(event);
    case EventTrigger.EventBridge:
      return { messageId: event.id };
    case EventTrigger.AppSync:
      return getAppSyncData(event);
    case EventTrigger.StepFunction:
      return {
        messageId: recursiveGetKey(event, LUMIGO_EVENT_KEY)[STEP_FUNCTION_UID_KEY],
      };
    case 'invocation':
    default:
      return {};
  }
};

export const getEventInfo = (event) => {
  const triggeredBy = getTriggeredBy(event);
  const eventData = safeExecute(() => getRelevantEventData(triggeredBy, event))() || {};

  return { ...eventData, triggeredBy };
};
