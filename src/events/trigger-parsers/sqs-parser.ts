import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class SqsEventParser extends EventTriggerParser {
  _shouldHandle = (event: IncomingEvent): boolean => {
    return event?.Records?.[0]?.eventSource === 'aws:sqs';
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    const arn = event.Records[0].eventSourceARN;
    const messageIds = [];
    event.Records.forEach((record) => record.messageId && messageIds.push(record.messageId));
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.SQS,
      fromMessageIds: messageIds,
      extra: { arn },
    };
  };

  extractInner = (event: IncomingEvent): string[] => {
    return event.Records.map((record) => record.body).filter((body) => !!body);
  };
}
