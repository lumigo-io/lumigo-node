import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';
import { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';

export class ApiGatewayEventParser extends EventTriggerParser {
  _shouldHandle = (event: IncomingEvent): boolean => {
    return (
      (event?.['httpMethod'] && event?.['requestContext']?.['stage']) ||
      (event?.['headers'] && event?.['version'] === '2.0' && event?.['requestContext']?.['stage'])
    );
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    const version = event?.['version'];

    if (version === '2.0') {
      return this.getApiGatewayV2Data(event, targetId);
    }

    return this.getApiGatewayV1Data(event, targetId);
  };

  getApiGatewayV1Data = (event: IncomingEvent, targetId: string | null): Trigger => {
    const { headers, resource, httpMethod, requestContext } = event;
    const { stage } = requestContext;

    const api = headers?.Host || null;
    const messageId = requestContext.requestId;

    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.ApiGateway,
      fromMessageIds: [messageId],
      extra: { api, stage, httpMethod, resource },
    };
  };
  getApiGatewayV2Data = (event: IncomingEvent, targetId: string | null): Trigger => {
    const httpMethod = event.requestContext?.http?.method;
    const resource = event.requestContext?.http?.path;
    const messageId = event.requestContext?.requestId;
    const api = event.requestContext?.domainName || null;
    const stage = event.requestContext?.stage || 'unknown';

    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.ApiGateway,
      fromMessageIds: messageId ? [messageId] : [],
      extra: { api, stage, httpMethod, resource },
    };
  };
}
