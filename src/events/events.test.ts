import * as events from './events';
import { getEventInfo } from './events';
import { TracerGlobals } from '../globals';
import { LUMIGO_EVENT_KEY, STEP_FUNCTION_UID_KEY } from '../utils';
import { Triggers } from '@lumigo/node-core';
import { EventTriggerParser } from './trigger-parsers/trigger-parser-base';

describe('events', () => {
  const getTestableTrigger = (event) => {
    return events.getEventInfo(event)?.trigger?.map((t) => {
      delete t.id;
      delete t.targetId;
      return t;
    });
  };

  test('getEventInfo', () => {
    TracerGlobals.setTracerInputs({ stepFunction: true });
    expect(
      getTestableTrigger({
        data: 1,
        [LUMIGO_EVENT_KEY]: { [STEP_FUNCTION_UID_KEY]: '123' },
      })
    ).toEqual([
      {
        triggeredBy: Triggers.MessageTrigger.StepFunction,
        fromMessageIds: ['123'],
      },
    ]);
  });

  test('test exception in shouldHandle', () => {
    class TestEventParser extends EventTriggerParser {
      _shouldHandle = (event) => {
        throw Error('Boom');
      };

      handle(message, targetId) {
        return undefined;
      }
    }

    expect(new TestEventParser().shouldHandle({})).toBeFalsy();
  });
});
