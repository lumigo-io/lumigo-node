const index = require('./index');

describe('tracer', () => {
  test('handler call the original function', () => {
    process.env[index.LUMIGO_SWITCH_OFF] = 'TRUE';

    process.env[index.ORIGINAL_HANDLER_KEY] = '';
    expect(() => index.handler({}, {})).toThrow(Error);

    process.env[index.ORIGINAL_HANDLER_KEY] = 'bad/handler/format';
    expect(() => index.handler({}, {})).toThrow(Error);

    process.env[index.ORIGINAL_HANDLER_KEY] = 'not/Existing.handler';
    expect(() => index.handler({}, {})).toThrowError("Cannot find module '/var/task/not/Existing' from 'index.js'");

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `../../${__dirname}/testdata/example_handler.not_existing`;
    expect(() => index.handler({}, {})).toThrow(Error);

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `../../${__dirname}/testdata/example_handler.my_handler`;
    expect(index.handler({}, {})).resolves.toEqual({ hello: 'world' });
  });
});
