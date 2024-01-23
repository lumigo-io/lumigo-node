import { ConsoleWritesForTesting } from '../testUtils/consoleMocker';
import * as globals from './globals';
import {
  DEFAULT_MAX_SIZE_FOR_REQUEST,
  DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR,
  MAX_TRACER_ADDED_DURATION_ALLOWED,
} from './globals';
import { getMaxRequestSize } from './utils';

describe('globals', () => {
  const setLambdaAsTraced = () => {
    process.env.LAMBDA_RUNTIME_DIR = 'true';
  };

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

  test('SpansContainer - cleanning the request size limiter', () => {
    const span1 = { a: 'b', c: 'd', id: '1' };
    for (let i = 0; i < getMaxRequestSize(); i++) {
      globals.SpansContainer.addSpan(span1);
    }
    let didAdd = globals.SpansContainer.addSpan(span1);
    expect(didAdd).toBeFalsy();

    globals.SpansContainer.clearSpans();

    didAdd = globals.SpansContainer.addSpan(span1);
    expect(didAdd).toBeTruthy();
    expect(globals.SpansContainer.getSpans()).toEqual([span1]);
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
    const context = {
      e: 'f',
      g: 'h',
      getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
    };
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
    const maxSizeForRequestOnError = 12345;
    globals.TracerGlobals.setTracerInputs({
      token,
      debug,
      edgeHost,
      switchOff,
      isStepFunction,
      maxSizeForRequest,
      maxSizeForRequestOnError,
    });
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token,
      debug,
      edgeHost,
      switchOff,
      isStepFunction,
      lambdaTimeout: MAX_TRACER_ADDED_DURATION_ALLOWED,
      maxSizeForRequest,
      maxSizeForRequestOnError,
    });
    globals.TracerGlobals.clearTracerInputs();
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token: '',
      debug: false,
      edgeHost: '',
      lambdaTimeout: MAX_TRACER_ADDED_DURATION_ALLOWED,
      switchOff: false,
      isStepFunction: false,
      maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
      maxSizeForRequestOnError: DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR,
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
    const context = {
      e: 'f',
      g: 'h',
      getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
    };

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
      lambdaTimeout: MAX_TRACER_ADDED_DURATION_ALLOWED,
      maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
      maxSizeForRequestOnError: DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR,
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
        msg: 'Lumigo Warning: Skipping addExecutionTag: Unable to add tag: key length should be between 1 and 50:  - v0',
        obj: undefined,
      },
    ]);
  });

  test('ExecutionTags.addTag too long key', () => {
    const key = 'k'.repeat(71);
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
        msg: 'Lumigo Warning: Skipping addExecutionTag: Unable to add tag: value length should be between 1 and 70: k0 - ',
        obj: undefined,
      },
    ]);
  });

  test('ExecutionTags.addTag too long value', () => {
    const value = 'v'.repeat(71);
    globals.ExecutionTags.addTag('k0', value);
    expect(globals.ExecutionTags.getTags()).toEqual([]);
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: `Lumigo Warning: Skipping addExecutionTag: Unable to add tag: value length should be between 1 and 70: k0 - ${value}`,
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
    jest.spyOn(global, 'String').mockImplementationOnce(() => {
      throw new Error();
    });
    globals.ExecutionTags.addTag('throw', 'exception');
    // No exception.
    expect(globals.ExecutionTags.getTags()).toEqual([]);
  });

  test('autoTagEvent', () => {
    process.env = { LUMIGO_AUTO_TAG: 'key1,key2' };
    setLambdaAsTraced();

    globals.ExecutionTags.autoTagEvent({
      key1: 'value1',
      key2: 2,
      key3: 'value3',
      other: 'other',
    });
    let result = globals.ExecutionTags.getTags();
    expect(result).toEqual([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: '2' },
    ]);
    globals.ExecutionTags.clear();

    globals.ExecutionTags.autoTagEvent({
      key1: 'value1',
      key2: JSON.stringify({ key2: 2 }),
    });
    result = globals.ExecutionTags.getTags();
    expect(result).toEqual([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: '{"key2":2}' },
    ]);
  });

  test('autoTagEvent key not exists', () => {
    process.env = { LUMIGO_AUTO_TAG: 'key1,key2' };
    setLambdaAsTraced();

    globals.ExecutionTags.autoTagEvent({
      key1: 'value1',
      key3: 'value3',
      other: 'other',
    });
    const result = globals.ExecutionTags.getTags();
    expect(result).toEqual([{ key: 'key1', value: 'value1' }]);
  });

  test('autoTagEvent nested', () => {
    process.env = { LUMIGO_AUTO_TAG: 'key1.key2' };
    setLambdaAsTraced();

    // only outer key
    globals.ExecutionTags.autoTagEvent({
      key1: 'value1',
      key2: 2,
      key3: 'value3',
      other: 'other',
    });
    let result = globals.ExecutionTags.getTags();
    expect(result).toEqual([]);

    // no key at all
    globals.ExecutionTags.autoTagEvent({
      key2: 2,
      key3: 'value3',
      other: 'other',
    });
    result = globals.ExecutionTags.getTags();
    expect(result).toEqual([]);

    // happy flow
    globals.ExecutionTags.autoTagEvent({
      key1: { key2: 'value' },
      key3: 'value3',
    });
    result = globals.ExecutionTags.getTags();
    expect(result).toEqual([{ key: 'key1.key2', value: 'value' }]);
    globals.ExecutionTags.clear();

    // happy flow - two nested
    process.env = { LUMIGO_AUTO_TAG: 'key1.key2,key3.key4,key4.key1' };
    setLambdaAsTraced();

    globals.ExecutionTags.autoTagEvent({
      key1: { key2: 'value' },
      key3: { key4: 'value2' },
      key4: { key1: 'value3' },
      key5: '1',
    });
    result = globals.ExecutionTags.getTags();
    expect(result).toEqual([
      { key: 'key1.key2', value: 'value' },
      { key: 'key3.key4', value: 'value2' },
      { key: 'key4.key1', value: 'value3' },
    ]);
    globals.ExecutionTags.clear();
  });

  test.each`
    envVarValue                        | event                                                                                     | expectedTags
    ${'key1.key2,key3,key1'}           | ${{ key1: JSON.stringify({ key2: JSON.stringify({ key4: 'value' }) }), key5: '1' }}       | ${[{ key: 'key1.key2', value: JSON.stringify({ key4: 'value' }) }, { key: 'key1', value: JSON.stringify({ key2: JSON.stringify({ key4: 'value' }) }) }]}
    ${'key1.key2,key3.key2'}           | ${{ key1: JSON.stringify({ key2: 'value' }), key3: JSON.stringify({ key2: 'value_1' }) }} | ${[{ key: 'key1.key2', value: 'value' }, { key: 'key3.key2', value: 'value_1' }]}
    ${'foo.bar'}                       | ${{ foo: '{"bar":"lol","secret":"****"}' }}                                               | ${[{ key: 'foo.bar', value: 'lol' }]}
    ${'key1'}                          | ${JSON.stringify({ key1: 'value', key3: 'value2' })}                                      | ${[{ key: 'key1', value: 'value' }]}
    ${'key1.key2'}                     | ${{ key1: JSON.stringify({ key2: 'value' }), key3: 'value3' }}                            | ${[{ key: 'key1.key2', value: 'value' }]}
    ${'key1.key2.key3'}                | ${{ key1: JSON.stringify({ key2: JSON.stringify({ key3: 'value' }) }), key5: '1' }}       | ${[{ key: 'key1.key2.key3', value: 'value' }]}
    ${'key1.key2,key1.key2.key3,key1'} | ${{ key1: JSON.stringify({ key2: JSON.stringify({ key3: 'value' }) }), key5: '1' }}       | ${[{ key: 'key1.key2', value: JSON.stringify({ key3: 'value' }) }, { key: 'key1.key2.key3', value: 'value' }, { key: 'key1', value: JSON.stringify({ key2: JSON.stringify({ key3: 'value' }) }) }]}
  `(
    'autoTagEvent for stringified events, envVarValue=$envVarValue',
    ({ envVarValue, event, expectedTags }) => {
      process.env = { LUMIGO_AUTO_TAG: envVarValue };
      setLambdaAsTraced();
      globals.ExecutionTags.autoTagEvent(event);
      let result = globals.ExecutionTags.getTags();
      expect(result).toEqual(expectedTags);
      globals.ExecutionTags.clear();
    }
  );

  test.each`
    killSwitchValue | isAwsEnvironment | expectedRetValue | expectedTags
    ${'FALSE'}      | ${'TRUE'}        | ${true}          | ${[{ key: 'k0', value: 'v0' }]}
    ${'TRUE'}       | ${'TRUE'}        | ${false}         | ${[]}
    ${'TRUE'}       | ${''}            | ${false}         | ${[]}
    ${'FALSE'}      | ${''}            | ${false}         | ${[]}
  `(
    'killSwitchValue=$killSwitchValue, isAwsEnvironment=$isAwsEnvironment, expectedRetValue=$expectedRetValue,expectedTags=$expectedTags',
    ({ killSwitchValue, isAwsEnvironment, expectedRetValue, expectedTags }) => {
      process.env.LUMIGO_SWITCH_OFF = killSwitchValue;
      process.env.LAMBDA_RUNTIME_DIR = isAwsEnvironment;

      const value = 'v0';
      const key = 'k0';
      expect(globals.ExecutionTags.addTag(key, value)).toEqual(expectedRetValue);
      expect(globals.ExecutionTags.getTags()).toEqual(expectedTags);
    }
  );
});
