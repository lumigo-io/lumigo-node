import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class SnsEventParser extends EventTriggerParser {
  MAGIC_IDENTIFIER = 'SimpleNotificationService';

  _shouldHandle = (event: IncomingEvent): boolean => {
    return (
      event?.Records?.[0]?.EventSource === 'aws:sns' ||
      (event?.Type === 'Notification' && event?.TopicArn)
    );
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    const record = event?.Records?.[0]?.Sns || event;
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.SNS,
      fromMessageIds: [record.MessageId],
      extra: {
        arn: record.TopicArn,
      },
    };
  };
}
