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

  if (event && event['httpMethod']) {
    return 'apigw';
  }

  return 'invocation';
};

export const getApiGatewayData = event => {
  const { headers = {}, resource, httpMethod, requestContext = {} } = event;
  const { stage = null } = requestContext;

  const api = headers['Host'] || null;
  const messageId = requestContext["requestId"];
  return { messageId, httpMethod, resource, stage, api };
};

export const getSnsData = event => {
  const { TopicArn: arn, MessageId: messageId } = event.Records[0].Sns;
  return { arn, messageId };
};

export const getKinesisData = event => {
  const arn = event.Records[0].eventSourceARN;
  const messageIds = (event.Records || []).map(r=> (r["kinesis"] || {})["sequenceNumber"]).filter(x => !!x);
  return { arn, messageIds };
};

export const getRelevantEventData = (triggeredBy, event) => {
  switch (triggeredBy) {
    case 'sqs':
    case 'dynamodb':
      return { arn: event.Records[0].eventSourceARN };
    case 'kinesis':
      return getKinesisData(event);
    case 'sns':
      return getSnsData(event);
    case 's3':
      return { arn: event.Records[0].s3.bucket.arn };
    case 'apigw':
      return getApiGatewayData(event);
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
