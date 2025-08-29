import { Triggers } from '@lumigo/node-core';
export declare abstract class EventTriggerParser {
    INNER_IDENTIFIER: string | null;
    shouldHandle: (message: Triggers.IncomingMessage) => boolean;
    abstract _shouldHandle(message: Triggers.IncomingMessage): boolean;
    abstract handle(message: Triggers.IncomingMessage, targetId: string | null): Triggers.Trigger;
    extractInner: (message: Triggers.IncomingMessage) => string[];
}
