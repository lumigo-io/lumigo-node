import { IncomingEvent, Trigger } from '../event-data.types';

export abstract class EventTriggerParser {
  MAGIC_IDENTIFIER: string | null = null;

  shouldHandle = (event: IncomingEvent): boolean => {
    try {
      return this._shouldHandle(event);
    } catch (e) {
      return false;
    }
  };

  abstract _shouldHandle(event: IncomingEvent): boolean;

  abstract handle(event: IncomingEvent, targetId: string | null): Trigger;

  extractInner = (event: IncomingEvent): string[] => {
    return [];
  };
}
