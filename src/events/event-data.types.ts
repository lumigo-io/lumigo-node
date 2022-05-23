import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { EventTrigger } from './event-trigger.enum';

export type IncomingEvent = { [key: string]: any };

export type EventInfo = EventData & {
  triggeredBy: EventTrigger | {},
};

export type EventData =
  | ApiGatewayV2EventData
  | AppSyncEventData
  | DynamoDBStreamEventData
  | SNSEventData
  | KinesisStreamEventData
  | SQSEventData;

export interface DynamoDBStreamEventData {
  arn: string;
  messageIds: string[];
  approxEventCreationTime?: number;
}

export interface SQSEventData {
  arn: string;
  // TODO: make at least one of the below options mandatory
  messageIds?: string[];
  messageId?: string;
}

export interface KinesisStreamEventData {
  arn: string;
  messageIds: string[];
}

export interface SNSEventData {
  arn: string;
  messageId: string;
}

export interface AppSyncEventData {
  api: string;
  messageId: string;
}

export interface ApiGatewayV2EventData {
  httpMethod: APIGatewayProxyEventV2['requestContext']['http']['method'];
  resource: APIGatewayProxyEventV2['requestContext']['http']['path'];
  messageId: APIGatewayProxyEventV2['requestContext']['requestId'];
  api: APIGatewayProxyEventV2['requestContext']['domainName'];
  stage: APIGatewayProxyEventV2['requestContext']['stage'] | 'unknown';
}
