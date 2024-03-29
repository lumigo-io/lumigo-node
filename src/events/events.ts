import { StepFunctionEventParser } from './trigger-parsers/step-function-parser';
import { Triggers } from '@lumigo/node-core';

Triggers.MESSAGE_TRIGGER_PARSERS.push(new StepFunctionEventParser());

export const getEventInfo = (event: Triggers.IncomingMessage): Triggers.MessageInfo => {
  const triggers = Triggers.recursiveParseTriggers(event);

  return { trigger: triggers };
};
