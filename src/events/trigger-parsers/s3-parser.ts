import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class S3EventParser extends EventTriggerParser {
  _shouldHandle = (event: IncomingEvent): boolean => {
    return event?.Records?.[0]?.eventSource === 'aws:s3';
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.S3,
      fromMessageIds: [event?.Records?.[0]?.responseElements?.['x-amz-request-id']],
      extra: {
        arn: event?.Records?.[0]?.s3?.bucket?.arn,
      },
    };
  };
}
