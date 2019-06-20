import * as globals from './globals';

describe('globals', () => {
  test('SpansHive', () => {
    const span1 = { a: 'b', c: 'd' };
    const span2 = { e: 'f', g: 'h' };
    globals.SpansHive.addSpan(span1);
    globals.SpansHive.addSpan(span2);
    expect(globals.SpansHive.getSpans()).toEqual([span1, span2]);
    globals.SpansHive.clearSpans();
    expect(globals.SpansHive.getSpans()).toEqual([]);
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
    const token = 'abcdefg';
    const edgeHost = 'zarathustra.com';
    globals.TracerGlobals.setTracerInputs({ token, edgeHost, switchOff });
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token,
      edgeHost,
      switchOff,
    });
    globals.TracerGlobals.clearTracerInputs();
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token: '',
      edgeHost: '',
      switchOff: false,
    });
  });

  test('clearGlobals', () => {
    const switchOff = true;
    const token = 'abcdefg';
    const edgeHost = 'zarathustra.com';
    const span1 = { a: 'b', c: 'd' };
    const span2 = { e: 'f', g: 'h' };
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    globals.SpansHive.addSpan(span1);
    globals.SpansHive.addSpan(span2);
    globals.TracerGlobals.setTracerInputs({ token, edgeHost, switchOff });
    globals.TracerGlobals.setHandlerInputs({ event, context });

    globals.clearGlobals();

    expect(globals.SpansHive.getSpans()).toEqual([]);
    expect(globals.TracerGlobals.getHandlerInputs()).toEqual({
      event: {},
      context: {},
    });
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token: '',
      edgeHost: '',
      switchOff: false,
    });
  });
});
