import { Triggers } from '@lumigo/node-core';

export abstract class EventTriggerParser {
  // Note: This file is a copy of the file in the node-core package.
  // It is copied here because of ts compilation issues: https://stackoverflow.com/questions/51860043/javascript-es6-typeerror-class-constructor-client-cannot-be-invoked-without-ne

  INNER_IDENTIFIER: string | null = null;

  shouldHandle = (message: Triggers.IncomingMessage): boolean => {
    try {
      return this._shouldHandle(message);
    } catch (e) {
      return false;
    }
  };

  abstract _shouldHandle(message: Triggers.IncomingMessage): boolean;

  abstract handle(message: Triggers.IncomingMessage, targetId: string | null): Triggers.Trigger;

  extractInner = (message: Triggers.IncomingMessage): string[] => {
    return [];
  };
}
