import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class KinesisEventParser extends EventTriggerParser {
  _shouldHandle = (event: IncomingEvent): boolean => {
    return event?.Records?.[0]?.eventSource === 'aws:kinesis';
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    const arn = event.Records[0].eventSourceARN;
    const messageIds = (event.Records || [])
      .map((record) => record.kinesis.sequenceNumber)
      .filter((recordSequenceNumber) => recordSequenceNumber != null);
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.Kinesis,
      fromMessageIds: messageIds,
      extra: { arn },
    };
  };
}
