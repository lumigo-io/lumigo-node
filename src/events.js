import {
  isStepFunction,
  recursiveGetKey,
  STEP_FUNCTION_UID_KEY,
  LUMIGO_EVENT_KEY,
  md5Hash,
} from './utils';

export const getTriggeredBy = event => {
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

  if (
    (event && event['httpMethod']) ||
    (event && event['headers'] && event['version'] === '2.0')
  ) {
    return 'apigw';
  }

  if (isStepFunction() && event && !!recursiveGetKey(event, LUMIGO_EVENT_KEY)) {
    return 'stepFunction';
  }

  return 'invocation';
};

const getApiGatewayV1Data = event => {
  const { headers = {}, resource, httpMethod, requestContext = {} } = event;
  const { stage = null } = requestContext;

  const api = headers['Host'] || null;
  const messageId = requestContext['requestId'];
  return { messageId, httpMethod, resource, stage, api };
};

const getApiGatewayV2Data = event => {
  const httpMethod = ((event['requestContext'] || {})['http'] || {})['method'];
  const resource = ((event['requestContext'] || {})['http'] || {})['path'];
  const messageId = (event['requestContext'] || {})['requestId'];
  const api = (event['requestContext'] || {})['domainName'];
  const stage = (event['requestContext'] || {})['stage'] || 'unknown';

  return { httpMethod, resource, messageId, api, stage };
};

export const getApiGatewayData = event => {
  const version = event['version'];
  if (version && version === '2.0') {
    return getApiGatewayV2Data(event);
  }
  return getApiGatewayV1Data(event);
};

export const getSnsData = event => {
  const { TopicArn: arn, MessageId: messageId } = event.Records[0].Sns;
  return { arn, messageId };
};

export const getKinesisData = event => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = (event.Records || [])
    .map(r => (r['kinesis'] || {})['sequenceNumber'])
    .filter(x => !!x);
  return { arn, messageIds };
};

export const getDynamodbData = event => {
  const arn = event.Records[0].eventSourceARN;
  const approxEventCreationTime =
    event.Records[0].dynamodb.ApproximateCreationDateTime * 1000;
  const messageIds = (event.Records || [])
    .map(record => {
      if (
        ['MODIFY', 'REMOVE'].includes(record.eventName) &&
        record.dynamodb &&
        record.dynamodb.Keys
      ) {
        return md5Hash(record.dynamodb.Keys);
      } else if (
        record.eventName === 'INSERT' &&
        record.dynamodb &&
        record.dynamodb.NewImage
      ) {
        return md5Hash(record.dynamodb.NewImage);
      }
    })
    .filter(x => !!x);
  return { arn, messageIds, approxEventCreationTime };
};

export const getRelevantEventData = (triggeredBy, event) => {
  switch (triggeredBy) {
    case 'sqs':
      return { arn: event.Records[0].eventSourceARN };
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
    case 'stepFunction':
      return {
        messageId: recursiveGetKey(event, LUMIGO_EVENT_KEY)[
          STEP_FUNCTION_UID_KEY
        ],
      };
    case 'invocation':
    default:
      return {};
  }
};

export const getEventInfo = event => {
  const triggeredBy = getTriggeredBy(event);
  const eventData = getRelevantEventData(triggeredBy, event);
  return { ...eventData, triggeredBy };
};
