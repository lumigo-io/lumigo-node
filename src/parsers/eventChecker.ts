import {
  APIGatewayEvent,
  APIGatewayProxyEventV2,
  CloudFrontRequestEvent,
  DynamoDBStreamEvent,
  S3Event,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda';

export const isApiGwEvent = (event): event is APIGatewayEvent | APIGatewayProxyEventV2 => {
  return event?.requestContext?.domainName != null && event?.requestContext?.requestId != null;
};

export const isSnsEvent = (event): event is SNSEvent => {
  return event?.Records?.[0]?.EventSource === 'aws:sns';
};

export const isSqsEvent = (event): event is SQSEvent => {
  return event?.Records?.[0]?.eventSource === 'aws:sqs';
};

export const isS3Event = (event): event is S3Event => {
  return event?.Records?.[0]?.eventSource === 'aws:s3';
};

export const isDDBEvent = (event): event is DynamoDBStreamEvent => {
  return event?.Records?.[0]?.eventSource === 'aws:dynamodb';
};

export const isCloudfrontEvent = (event): event is CloudFrontRequestEvent => {
  return event?.Records?.[0]?.cf?.config?.distributionId != null;
};
