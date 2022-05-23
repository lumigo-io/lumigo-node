import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  AppSyncResolverEventHeaders,
  DynamoDBRecord,
  KinesisStreamRecord,
  KinesisStreamRecordPayload,
  S3EventRecord,
  SNSMessage,
  SQSRecord,
} from 'aws-lambda';
import type { EventTrigger } from './event-trigger.enum';

export type IncomingEvent = Record<string, any>;

export type IncomingEventRecord = IncomingEvent['Records'][0];

export type EventInfo = EventData & {
  triggeredBy: EventTrigger,
};

export type EventData =
  | ApiGatewayV1EventData
  | ApiGatewayV2EventData
  | AppSyncEventData
  | DynamoDBStreamEventData
  | EventBridgeEventData
  | S3EventData
  | SNSEventData
  | SQSEventData
  | StepFunctionEventData
  | KinesisStreamEventData
  | Record<string, never>;

export interface DynamoDBStreamEventData {
  arn: DynamoDBRecord['eventSourceARN'];
  messageIds: string[];
  approxEventCreationTime?: DynamoDBRecord['dynamodb']['ApproximateCreationDateTime'];
}

export type SQSEventData = {
  arn: SQSRecord['eventSourceARN'],
} & (
  | {
      messageIds: SQSRecord['messageId'][],
    }
  | {
      messageId: SQSRecord['messageId'],
    }
);

export interface S3EventData {
  arn: S3EventRecord['s3']['bucket']['arn'];
}

export interface KinesisStreamEventData {
  arn: KinesisStreamRecord['eventSourceARN'];
  messageIds: KinesisStreamRecordPayload['sequenceNumber'][];
}

export interface SNSEventData {
  arn: SNSMessage['TopicArn'];
  messageId: SNSMessage['MessageId'];
}

export interface AppSyncEventData {
  api: AppSyncResolverEventHeaders['host'];
  messageId: AppSyncResolverEventHeaders['x-amzn-trace-id'];
}

export interface ApiGatewayV1EventData {
  messageId: APIGatewayProxyEvent['requestContext']['requestId'];
  httpMethod: APIGatewayProxyEvent['httpMethod'];
  resource: APIGatewayProxyEvent['resource'];
  stage: APIGatewayProxyEvent['requestContext']['stage'];
  api: APIGatewayProxyEvent['headers'][0];
}

export interface ApiGatewayV2EventData {
  httpMethod: APIGatewayProxyEventV2['requestContext']['http']['method'];
  resource: APIGatewayProxyEventV2['requestContext']['http']['path'];
  messageId: APIGatewayProxyEventV2['requestContext']['requestId'];
  api: APIGatewayProxyEventV2['requestContext']['domainName'];
  stage: APIGatewayProxyEventV2['requestContext']['stage'] | 'unknown';
}

export interface EventBridgeEventData {
  messageId: string;
}

export interface StepFunctionEventData {
  messageId: string;
}
