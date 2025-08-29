import { Triggers } from '@lumigo/node-core';
import { EventTriggerParser } from './trigger-parser-base';
export declare class StepFunctionEventParser extends EventTriggerParser {
    _shouldHandle: (event: Triggers.IncomingMessage) => boolean;
    handle: (event: Triggers.IncomingMessage, targetId: string | null) => Triggers.Trigger;
}
