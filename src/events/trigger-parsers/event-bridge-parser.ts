import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class EventBridgeEventParser extends EventTriggerParser {
  MAGIC_IDENTIFIER = 'detail-type';

  _shouldHandle = (event: IncomingEvent): boolean => {
    return (
      typeof event?.version === 'string' &&
      typeof event?.id === 'string' &&
      typeof event?.['detail-type'] === 'string' &&
      typeof event?.source === 'string' &&
      typeof event?.time === 'string' &&
      typeof event?.region === 'string' &&
      Array.isArray(event?.resources) &&
      typeof event?.detail === 'object'
    );
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.EventBridge,
      fromMessageIds: [event.id],
    };
  };
}
