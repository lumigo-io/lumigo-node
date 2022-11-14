import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import {
  getRandomId,
  isStepFunction,
  LUMIGO_EVENT_KEY,
  md5Hash,
  recursiveGetKey,
  STEP_FUNCTION_UID_KEY,
} from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class StepFunctionEventParser extends EventTriggerParser {
  _shouldHandle = (event: IncomingEvent): boolean => {
    return isStepFunction() && event != null && !!recursiveGetKey(event, LUMIGO_EVENT_KEY);
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.StepFunction,
      fromMessageIds: [recursiveGetKey(event, LUMIGO_EVENT_KEY)[STEP_FUNCTION_UID_KEY]],
    };
  };
}
