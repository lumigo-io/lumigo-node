const index = require('./index');

describe('tracer', () => {
  test('handler call the original function', () => {
    process.env[index.LUMIGO_SWITCH_OFF] = 'TRUE';

    process.env[index.ORIGINAL_HANDLER_KEY] = '';
    expect(() => index.handler({}, {})).toThrowError("Could not load the original handler. Are you sure that the handler is correct?");

    process.env[index.ORIGINAL_HANDLER_KEY] = 'bad/handler/format';
    expect(() => index.handler({}, {})).toThrowError("Could not parse the original handler - invalid format");

    process.env[index.ORIGINAL_HANDLER_KEY] = 'not/Existing.handler';
    expect(() => index.handler({}, {})).toThrowError("Cannot find module '/var/task/not/Existing' from 'index.js'");

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `../../${__dirname}/testdata/example_handler.not_existing`;
    expect(() => index.handler({}, {})).toThrowError(`Could not find the handler's function (not_existing) inside the handler's file (/var/task/../../${__dirname}/testdata/example_handler)`);

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `../../${__dirname}/testdata/example_handler.my_handler`;
    expect(index.handler({}, {})).resolves.toEqual({ hello: 'world' });
  });
});
