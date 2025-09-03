import {
  getRandomId,
  isStepFunction,
  LUMIGO_EVENT_KEY,
  recursiveGetKey,
  STEP_FUNCTION_UID_KEY,
} from '../../utils';
import { Triggers } from '@lumigo/node-core';
import { EventTriggerParser } from './trigger-parser-base';

export class StepFunctionEventParser extends EventTriggerParser {
  _shouldHandle = (event: Triggers.IncomingMessage): boolean => {
    return isStepFunction() && event != null && !!recursiveGetKey(event, LUMIGO_EVENT_KEY);
  };

  handle = (event: Triggers.IncomingMessage, targetId: string | null): Triggers.Trigger => {
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: Triggers.MessageTrigger.StepFunction,
      fromMessageIds: [recursiveGetKey(event, LUMIGO_EVENT_KEY)[STEP_FUNCTION_UID_KEY]],
    };
  };
}
