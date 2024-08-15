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

  test('removeLumigoFromStacktrace - unhandled promise exception', () => {
    const err = {
        stack:
            'Error: Error: I am an error\n    ' +
            'at /opt/nodejs/node_modules/@lumigo/tracer/dist/tracer/tracer.js:269:31\n    ' +
            'at step (/opt/nodejs/node_modules/@lumigo/tracer/dist/tracer/tracer.js:33:23)\n    ' +
            'at Object.next (/opt/nodejs/node_modules/@lumigo/tracer/dist/tracer/tracer.js:14:53)\n    ' +
            'at /opt/nodejs/node_modules/@lumigo/tracer/dist/tracer/tracer.js:8:71\n    ' +
            'at new Promise (<anonymous>)\n    ' +
            'at __awaiter (/opt/nodejs/node_modules/@lumigo/tracer/dist/tracer/tracer.js:4:12)\n    ' +
            'at events.unhandledRejection (/opt/nodejs/node_modules/@lumigo/tracer/dist/tracer/tracer.js:264:73)\n    ' +
            'at process.emit (node:events:519:28)\n    ' +
            'at emitUnhandledRejection (node:internal/process/promises:250:13)\n    ' +
            'at throwUnhandledRejectionsMode (node:internal/process/promises:385:19)',
    };

    const data = 'abcd';
    const type = '1234';
    const handlerReturnValue = { err, data, type };

    const expectedErr = {
        stack:
            'Error: Error: I am an error\n    ' +
            'at new Promise (<anonymous>)\n    ' +
            'at process.emit (node:events:519:28)\n    ' +
            'at emitUnhandledRejection (node:internal/process/promises:250:13)\n    ' +
            'at throwUnhandledRejectionsMode (node:internal/process/promises:385:19)',
    };
    const expectedHandlerReturnValue = { err: expectedErr, data, type };

    expect(index.removeLumigoFromStacktrace(handlerReturnValue)).toEqual(expectedHandlerReturnValue);
  });
});
