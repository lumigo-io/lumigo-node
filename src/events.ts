import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  DynamoDBStreamEvent,
  KinesisStreamEvent,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda';

import {
  isStepFunction,
  recursiveGetKey,
  STEP_FUNCTION_UID_KEY,
  LUMIGO_EVENT_KEY,
  md5Hash,
  safeExecute,
} from './utils';
import { AppSyncResolverEvent } from 'aws-lambda/trigger/appsync-resolver';
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';

export const getTriggeredBy = (event) => {
  if (event && event['Records']) {
    // XXX Parses s3, sns, ses, kinesis, dynamodb event sources.
    const { eventSource, EventSource } = event.Records[0];
    const eventSourceStr = eventSource || EventSource;
    if (eventSourceStr) {
      // XXX AWS EventSources are formatted as "aws:$EVENT_SOURCE_NAME"
      // See https://github.com/aws/aws-lambda-go/tree/master/events/testdata
      // eslint-disable-next-line
      const [_, eventSourceName] = eventSourceStr.split(':');
      return eventSourceName;
    }
  }

  if ((event && event['httpMethod']) || (event && event['headers'] && event['version'] === '2.0')) {
    return 'apigw';
  }

  if (isAppSyncEvent(event)) {
    return 'appsync';
  }

  if (isStepFunction() && event && !!recursiveGetKey(event, LUMIGO_EVENT_KEY)) {
    return 'stepFunction';
  }

  if (isEventBridgeEvent(event)) {
    return 'eventBridge';
  }

  return 'invocation';
};

export const isAppSyncEvent = (event) => {
  return (
    (event &&
      event['context'] &&
      event['context']['request'] &&
      event['context']['request']['headers'] &&
      event['context']['request']['headers']['host'] &&
      event['context']['request']['headers']['host'].includes('appsync-api')) ||
    (event &&
      event['request'] &&
      event['request']['headers'] &&
      event['request']['headers']['host'] &&
      event['request']['headers']['host'].includes('appsync-api'))
  );
};

export const isEventBridgeEvent = (event) => {
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
  const messageId = requestContext.requestId;
  return { messageId, httpMethod, resource, stage, api };
};

const getApiGatewayV2Data = (event: APIGatewayProxyEventV2) => {
  const httpMethod = event.requestContext.http.method;
  const resource = event.requestContext.http.path;
  const messageId = event.requestContext.requestId;
  const api = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  return { httpMethod, resource, messageId, api, stage };
};

export const getApiGatewayData = (event: APIGatewayProxyEvent | APIGatewayProxyEventV2) => {
  const version = event['version'];
  if (version && version === '2.0') {
    return getApiGatewayV2Data(<APIGatewayProxyEventV2>event);
  }
  return getApiGatewayV1Data(event);
};

export const getAppSyncData = (event: any) => {
  //TODO: Fix this function
  if (event.context) {
    const { host, 'x-amzn-trace-id': traceId } = event.context.request.headers;
    return { api: host, messageId: traceId.split('=')[1] };
  } else {
    const { host, 'x-amzn-trace-id': traceId } = event.request.headers;
    return { api: host, messageId: traceId.split('=')[1] };
  }
};

export const getSnsData = (event: SNSEvent) => {
  const { TopicArn: arn, MessageId: messageId } = event.Records[0].Sns;
  return { arn, messageId };
};

export const getKinesisData = (event: KinesisStreamEvent) => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = event.Records.map((r) => r.kinesis.sequenceNumber);
  return { arn, messageIds };
};

export const getSqsData = (event: SQSEvent) => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = event.Records.map((r) => r.messageId);
  if (messageIds.length === 1) return { arn, messageId: messageIds[0] };
  return { arn, messageIds };
};

export const getDynamodbData = (event: DynamoDBStreamEvent) => {
  const arn = event.Records[0].eventSourceARN;
  const approxEventCreationTime = event.Records[0].dynamodb.ApproximateCreationDateTime * 1000;
  const messageIds = (event.Records || [])
    .map((record) => {
      if (['MODIFY', 'REMOVE'].includes(record.eventName) && record.dynamodb?.Keys) {
        return md5Hash(record.dynamodb.Keys);
      } else if (record.eventName === 'INSERT' && record.dynamodb?.NewImage) {
        return md5Hash(record.dynamodb.NewImage);
      }
    })
    .filter((x) => !!x);
  return { arn, messageIds, approxEventCreationTime };
};

export const getRelevantEventData = (triggeredBy: string, event) => {
  switch (triggeredBy) {
    case 'sqs':
      return getSqsData(event);
    case 'dynamodb':
      return getDynamodbData(event);
    case 'kinesis':
      return getKinesisData(event);
    case 'sns':
      return getSnsData(event);
    case 's3':
      return { arn: event.Records[0].s3.bucket.arn };
    case 'apigw':
      return getApiGatewayData(event);
    case 'eventBridge':
      return { messageId: event.id };
    case 'appsync':
      return getAppSyncData(event);
    case 'stepFunction':
      return {
        messageId: recursiveGetKey(event, LUMIGO_EVENT_KEY)[STEP_FUNCTION_UID_KEY],
      };
    case 'invocation':
    default:
      return {};
  }
};

export const getEventInfo = (event: {}) => {
  const triggeredBy = getTriggeredBy(event);
  const eventData = safeExecute(() => getRelevantEventData(triggeredBy, event))() || {};
  return { ...eventData, triggeredBy };
};
