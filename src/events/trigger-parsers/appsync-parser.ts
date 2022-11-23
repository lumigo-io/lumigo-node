import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId, md5Hash } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class AppSyncEventParser extends EventTriggerParser {
  _shouldHandle = (event: IncomingEvent): boolean => {
    return event?.request?.headers?.host?.includes('appsync-api');
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    const { host, 'x-amzn-trace-id': traceId } = event.request.headers;
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.AppSync,
      fromMessageIds: [traceId.split('=')[1]],
      extra: {
        api: host,
      },
    };
  };
}
