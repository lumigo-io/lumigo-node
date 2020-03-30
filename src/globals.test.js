import * as globals from './globals';

describe('globals', () => {
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

  test('setGlobals token', () => {
    const token = 'fromParameters';
    process.env.LUMIGO_TRACER_TOKEN = 'fromEnvs';

    globals.TracerGlobals.setTracerInputs({ token });
    expect(globals.TracerGlobals.getTracerInputs().token).toEqual(
      'fromParameters'
    );

    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().token).toEqual('fromEnvs');
  });

  test('setGlobals debug', () => {
    process.env.LUMIGO_DEBUG = 'TRUE';
    globals.TracerGlobals.setTracerInputs({ debug: true });
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(true);

    process.env.LUMIGO_DEBUG = 'TRUE';
    globals.TracerGlobals.setTracerInputs({ debug: false });
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(true);

    process.env.LUMIGO_DEBUG = 'TRUE';
    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(true);

    process.env.LUMIGO_DEBUG = '';
    globals.TracerGlobals.setTracerInputs({ debug: true });
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(true);

    process.env.LUMIGO_DEBUG = '';
    globals.TracerGlobals.setTracerInputs({ debug: false });
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(false);

    process.env.LUMIGO_DEBUG = '';
    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().debug).toEqual(false);
  });

  test('setGlobals switchOff', () => {
    process.env.LUMIGO_SWITCH_OFF = 'TRUE';
    globals.TracerGlobals.setTracerInputs({ switchOff: true });
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(true);

    process.env.LUMIGO_SWITCH_OFF = 'TRUE';
    globals.TracerGlobals.setTracerInputs({ switchOff: false });
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(true);

    process.env.LUMIGO_SWITCH_OFF = 'TRUE';
    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(true);

    process.env.LUMIGO_SWITCH_OFF = '';
    globals.TracerGlobals.setTracerInputs({ switchOff: true });
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(true);

    process.env.LUMIGO_SWITCH_OFF = '';
    globals.TracerGlobals.setTracerInputs({ switchOff: false });
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(false);

    process.env.LUMIGO_SWITCH_OFF = '';
    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().switchOff).toEqual(false);
  });

  test('setGlobals edgeHost', () => {
    const edgeHost = 'fromParameters';
    process.env.LUMIGO_TRACER_HOST = 'fromEnvs';

    globals.TracerGlobals.setTracerInputs({ edgeHost });
    expect(globals.TracerGlobals.getTracerInputs().edgeHost).toEqual(
      'fromParameters'
    );

    globals.TracerGlobals.setTracerInputs({});
    expect(globals.TracerGlobals.getTracerInputs().edgeHost).toEqual(
      'fromEnvs'
    );
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
    globals.TracerGlobals.setTracerInputs({
      token,
      debug,
      edgeHost,
      switchOff,
      isStepFunction,
    });
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token,
      debug,
      edgeHost,
      switchOff,
      isStepFunction,
    });
    globals.TracerGlobals.clearTracerInputs();
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
      isStepFunction: false,
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
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
      isStepFunction: false,
    });
  });
});
