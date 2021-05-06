import * as globals from './globals';
import { ConsoleWritesForTesting } from '../testUtils/consoleMocker';
import { DEFAULT_MAX_SIZE_FOR_REQUEST, Timer } from './globals';
import * as logger from './logger';

describe('globals', () => {
  const spies = {};
  spies.logger = jest.spyOn(logger, 'warnClient');

  describe('Timer - tests', () => {
    function timeout(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    test('test timer time is increased and paused as expected', async () => {
      Timer.init(1000);
      // start
      Timer.start();
      await timeout(10);
      // pause
      Timer.pause();
      await timeout(10);
      // start
      Timer.start();
      await timeout(10);
      // pause
      Timer.pause();
      await timeout(10);
      // start
      Timer.start();
      await timeout(5);
      Timer.pause();
      const time = Timer.getTime();
      expect(time).toBeGreaterThanOrEqual(25);
      expect(time).toBeLessThanOrEqual(35);
      expect(Timer.isTimePassed()).toBe(false);
    });
    test('test timer event is called after duration', async () => {
      Timer.init(5);
      Timer.start();
      await timeout(10);
      expect(Timer.isTimePassed()).toEqual(true);
      expect(spies.logger).toBeCalledWith(
        'Lumigo tracer reached its timeout and will no longer collect data'
      );
    });

    test('test timer decorator for class methods', async () => {
      Timer.init(110);
      class A {
        @Timer.timedAsync()
        async a() {
          await timeout(100);
        }
      }
      const a = new A();
      await a.a();
      await timeout(20);
      expect(Timer.getTime()).toBeLessThanOrEqual(110);
      expect(Timer.getTime()).toBeGreaterThanOrEqual(100);
      await a.a();
      await timeout(10);
      expect(Timer.isTimePassed()).toBe(true);
      expect(Timer.getTime()).toBeLessThanOrEqual(220);
      expect(Timer.getTime()).toBeGreaterThanOrEqual(200);
    });
  });

  test('SpansContainer - simple flow', () => {
    const span1 = { a: 'b', c: 'd', id: '1' };
    const span2 = { e: 'f', g: 'h', id: '2' };
    globals.SpansContainer.addSpan(span1);
    globals.SpansContainer.addSpan(span2);
    expect(globals.SpansContainer.getSpans()).toEqual([span1, span2]);
    globals.SpansContainer.clearSpans();
    expect(globals.SpansContainer.getSpans()).toEqual([]);
  });

  test('SpansContainer - override spans', () => {
    const span1 = { a: 'b', c: 'd', id: '1' };
    const span2 = { e: 'f', g: 'h', id: '1' };
    globals.SpansContainer.addSpan(span1);
    globals.SpansContainer.addSpan(span2);
    expect(globals.SpansContainer.getSpans()).toEqual([span2]);
  });

  test('SpansContainer - changeSpanId', () => {
    const span1 = { a: 'b', id: '1' };
    globals.SpansContainer.addSpan(span1);
    globals.SpansContainer.changeSpanId('1', '2');
    expect(globals.SpansContainer.getSpans()).toEqual([{ a: 'b', id: '2' }]);
  });

  test('SpansContainer - changeSpanId -> old span not exist', () => {
    globals.SpansContainer.changeSpanId('1', '2');
    //Nothing fails
  });

  test('SpansContainer - getSpanById', () => {
    const span1 = { a: 'b', c: 'd', id: '1' };
    globals.SpansContainer.addSpan(span1);
    expect(globals.SpansContainer.getSpanById('1')).toEqual(span1);
  });

  test('SpansContainer - clean is pure', () => {
    const span1 = { a: 'b', c: 'd', id: '1' };
    globals.SpansContainer.addSpan(span1);

    const spans = globals.SpansContainer.getSpans();
    globals.SpansContainer.clearSpans();

    expect(globals.SpansContainer.getSpans()).toEqual([]);
    expect(spans).toEqual([span1]);
  });

  test('GlobalTimer - simple flow', (done) => {
    globals.GlobalTimer.setGlobalTimeout(() => {
      done();
    }, 1);
  });

  test('GlobalTimer - override timers', (done) => {
    const arr = [];
    globals.GlobalTimer.setGlobalTimeout(() => {
      arr.push(1);
    }, 50);
    globals.GlobalTimer.setGlobalTimeout(() => {
      arr.push(2);
      expect(arr).toEqual([2]);
      done();
    }, 100);
  });

  test('GlobalTimer - clear', (done) => {
    const arr = [];
    globals.GlobalTimer.setGlobalTimeout(() => {
      arr.push(1);
    }, 1);
    globals.GlobalTimer.clearTimer();

    setTimeout(() => {
      expect(arr).toEqual([]);
      done();
    }, 50);
  });

  test('GlobalTimer - async func flow', (done) => {
    const array = [];

    const addToArrayAsync = (ms) =>
      new Promise((resolve) =>
        setTimeout(() => {
          array.push(1);
          resolve();
        }, ms)
      );

    globals.GlobalTimer.setGlobalTimeout(async () => {
      await addToArrayAsync(1);
      expect(array).toEqual([1]);
      done();
    }, 1);
  });

  test('GlobalTimer - clears with clearGlobals', (done) => {
    const arr = [];
    globals.GlobalTimer.setGlobalTimeout(() => {
      //This should run after the globals.clearGlobals()
      arr.push(1);
    }, 1);

    //clearGlobal is aborting the pending timeout timer
    globals.clearGlobals();

    setTimeout(() => {
      expect(arr).toEqual([]);
      done();
    }, 50);
  });

  test('GlobalTimer - clear timer when timer not exists', () => {
    globals.GlobalTimer.clearTimer();
    //Expect no error will up
  });

  test('GlobalTimer - clears with clearGlobals - async', (done) => {
    const arr = [];
    globals.GlobalTimer.setGlobalTimeout(async () => {
      arr.push(1);
    }, 1);
    globals.clearGlobals();

    setTimeout(async () => {
      expect(arr).toEqual([]);
      done();
    }, 50);
  });

  test('setGlobals token', () => {
    const token = 'fromParameters';
    process.env.LUMIGO_TRACER_TOKEN = 'fromEnvs';

    globals.TracerGlobals.setTracerInputs({ token });
    expect(globals.TracerGlobals.getTracerInputs().token).toEqual('fromParameters');

    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().token).toEqual('fromEnvs');
  });

  test('setGlobals debug', () => {
    globals.TracerGlobals.setTracerInputs({ debug: true });
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(true);

    globals.TracerGlobals.setTracerInputs({ debug: false });
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(false);
  });

  test('setGlobals switchOff', () => {
    globals.TracerGlobals.setTracerInputs({ switchOff: true });
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(true);

    globals.TracerGlobals.setTracerInputs({ switchOff: false });
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(false);
  });

  test('setGlobals edgeHost', () => {
    const edgeHost = 'fromParameters';
    process.env.LUMIGO_TRACER_HOST = 'fromEnvs';

    globals.TracerGlobals.setTracerInputs({ edgeHost });
    expect(globals.TracerGlobals.getTracerInputs().edgeHost).toEqual('fromParameters');

    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().edgeHost).toEqual('fromEnvs');
  });

  test('setGlobals stepFunction', () => {
    globals.TracerGlobals.setTracerInputs({ stepFunction: true });
    expect(globals.TracerGlobals.getTracerInputs().isStepFunction).toBeTruthy();

    process.env.LUMIGO_STEP_FUNCTION = 'True';
    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().isStepFunction).toBeTruthy();
    process.env.LUMIGO_STEP_FUNCTION = undefined;

    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().isStepFunction).toBeFalsy();
  });

  test('TracerGlobals', () => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    globals.TracerGlobals.setHandlerInputs({ event, context });
    expect(globals.TracerGlobals.getHandlerInputs()).toEqual({
      event,
      context,
    });
    globals.TracerGlobals.clearHandlerInputs();
    expect(globals.TracerGlobals.getHandlerInputs()).toEqual({
      event: {},
      context: {},
    });

    const switchOff = true;
    const debug = true;
    const token = 'abcdefg';
    const edgeHost = 'zarathustra.com';
    const isStepFunction = false;
    const maxSizeForRequest = 1234;
    globals.TracerGlobals.setTracerInputs({
      token,
      debug,
      edgeHost,
      switchOff,
      isStepFunction,
      maxSizeForRequest,
    });
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token,
      debug,
      edgeHost,
      switchOff,
      isStepFunction,
      maxSizeForRequest,
    });
    globals.TracerGlobals.clearTracerInputs();
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
      isStepFunction: false,
      maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
    });
  });

  test('clearGlobals', () => {
    const switchOff = true;
    const debug = true;
    const token = 'abcdefg';
    const edgeHost = 'zarathustra.com';
    const span1 = { a: 'b', c: 'd' };
    const span2 = { e: 'f', g: 'h' };
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    globals.SpansContainer.addSpan(span1);
    globals.SpansContainer.addSpan(span2);
    globals.TracerGlobals.setTracerInputs({
      token,
      edgeHost,
      switchOff,
      debug,
    });
    globals.TracerGlobals.setHandlerInputs({ event, context });

    globals.clearGlobals();

    expect(globals.SpansContainer.getSpans()).toEqual([]);
    expect(globals.TracerGlobals.getHandlerInputs()).toEqual({
      event: {},
      context: {},
    });
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token,
      debug,
      edgeHost,
      switchOff,
      isStepFunction: false,
      maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
    });
  });

  test('ExecutionTags one tag', () => {
    const value = 'v0';
    const key = 'k0';
    globals.ExecutionTags.addTag(key, value);
    expect(globals.ExecutionTags.getTags()).toEqual([{ key, value }]);

    globals.ExecutionTags.clear();
    expect(globals.ExecutionTags.getTags()).toEqual([]);
  });

  test('ExecutionTags multiple tags', () => {
    globals.ExecutionTags.addTag('k0', 'v0');
    globals.ExecutionTags.addTag('k1', 'v1');
    expect(globals.ExecutionTags.getTags()).toEqual([
      { key: 'k0', value: 'v0' },
      { key: 'k1', value: 'v1' },
    ]);

    globals.ExecutionTags.clear();
    expect(globals.ExecutionTags.getTags()).toEqual([]);
  });

  test('ExecutionTags.addTag empty key', () => {
    globals.ExecutionTags.addTag('', 'v0');
    expect(globals.ExecutionTags.getTags()).toEqual([]);
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg:
          'Lumigo Warning: Skipping addExecutionTag: Unable to add tag: key length should be between 1 and 50:  - v0',
        obj: undefined,
      },
    ]);
  });

  test('ExecutionTags.addTag too long key', () => {
    const key = 'k'.repeat(51);
    globals.ExecutionTags.addTag(key, 'v0');
    expect(globals.ExecutionTags.getTags()).toEqual([]);
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: `Lumigo Warning: Skipping addExecutionTag: Unable to add tag: key length should be between 1 and 50: ${key} - v0`,
        obj: undefined,
      },
    ]);
  });

  test('ExecutionTags.addTag empty value', () => {
    globals.ExecutionTags.addTag('k0', '');
    expect(globals.ExecutionTags.getTags()).toEqual([]);
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg:
          'Lumigo Warning: Skipping addExecutionTag: Unable to add tag: value length should be between 1 and 50: k0 - ',
        obj: undefined,
      },
    ]);
  });

  test('ExecutionTags.addTag too long value', () => {
    const value = 'v'.repeat(51);
    globals.ExecutionTags.addTag('k0', value);
    expect(globals.ExecutionTags.getTags()).toEqual([]);
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: `Lumigo Warning: Skipping addExecutionTag: Unable to add tag: value length should be between 1 and 50: k0 - ${value}`,
        obj: undefined,
      },
    ]);
  });

  test('ExecutionTags.addTag too many tags', () => {
    for (let i = 0; i < 51; i++) globals.ExecutionTags.addTag(`k${i}`, `v${i}`);
    expect(globals.ExecutionTags.getTags().length).toEqual(50);
    expect(globals.ExecutionTags.getTags().filter((tag) => tag.key === 'k50')).toEqual([]);
  });

  test('ExecutionTags.addTag catch exception', () => {
    jest.spyOn(global, 'String').mockImplementation(() => {
      throw new Error();
    });
    globals.ExecutionTags.addTag('throw', 'exception');
    // No exception.
    expect(globals.ExecutionTags.getTags()).toEqual([]);
  });
});
