const globals = require('./globals');

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

    const token = 'abcdefg';
    const edgeHost = 'zarathustra.com';
    const switchOff = true;
    globals.TracerGlobals.setTracerInputs({ token, edgeHost, switchOff });
    expect(globals.TracerGlobals.getTracerInputs()).toEqual({
      token,
      edgeHost,
      switchOff,
    });
  });
});
