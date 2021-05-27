const index = require('./index');

describe('tracer', () => {
  test('handler call the original function', () => {
    process.env[index.LUMIGO_SWITCH_OFF] = 'TRUE';
    process.env.LAMBDA_TASK_ROOT = '/var/task';

    delete process.env[index.ORIGINAL_HANDLER_KEY];
    expect(() => index.handler({}, {})).toThrowError(
      'Could not load the original handler. Please contact Lumigo.'
    );

    process.env[index.ORIGINAL_HANDLER_KEY] = '';
    expect(() => index.handler({}, {})).toThrowError(
      'Bad handler'
    );

    process.env[index.ORIGINAL_HANDLER_KEY] = 'bad/handler/format';
    expect(() => index.handler({}, {})).toThrowError(
      'Bad handler'
    );

    process.env[index.ORIGINAL_HANDLER_KEY] = 'not/Existing.handler';
    try {
      index.handler({}, {});
      fail('should raise');
    } catch (e) {
      expect(e.message).toContain("Cannot resolve module");
      expect(e.stack).not.toContain('auto-instrument');
    }

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `${__dirname}/testdata/example_handler.not_existing`;
    expect(() => index.handler({}, {})).toThrowError(
      `${__dirname}/testdata/example_handler.not_existing is undefined or not exported`
    );

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `${__dirname}/testdata/example_handler.my_handler`;
    expect(index.handler({}, {})).resolves.toEqual({ hello: 'world' });
  });

});
