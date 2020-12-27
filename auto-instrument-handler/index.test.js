const index = require('./index');

describe('tracer', () => {
  test('handler call the original function', () => {
    process.env[index.LUMIGO_SWITCH_OFF] = 'TRUE';

    process.env[index.ORIGINAL_HANDLER_KEY] = '';
    expect(() => index.handler({}, {})).toThrowError(
      'Could not load the original handler. Are you sure that the handler is correct?'
    );

    process.env[index.ORIGINAL_HANDLER_KEY] = 'bad/handler/format';
    expect(() => index.handler({}, {})).toThrowError(
      'Could not parse the original handler - invalid format'
    );

    process.env[index.ORIGINAL_HANDLER_KEY] = 'not/Existing.handler';
    try {
      index.handler({}, {});
      fail('should raise');
    } catch (e) {
      expect(e.message).toEqual("Cannot find module '/var/task/not/Existing' from 'index.js'");
      expect(e.stack).not.toContain('auto-instrument');
    }

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `../../${__dirname}/testdata/example_handler.not_existing`;
    expect(() => index.handler({}, {})).toThrowError(
      `Could not find the handler's function (not_existing) inside the handler's file (/var/task/../../${__dirname}/testdata/example_handler)`
    );

    process.env[
      index.ORIGINAL_HANDLER_KEY
    ] = `../../${__dirname}/testdata/example_handler.my_handler`;
    expect(index.handler({}, {})).resolves.toEqual({ hello: 'world' });
  });

  test('parseOriginalHandler relative path', () => {
    const result = index._utils.parseOriginalHandler('src/handler.handler');
    expect(result).toEqual(['/var/task/src/handler', 'handler']);
  });

  test('parseOriginalHandler absolute path', () => {
    const result = index._utils.parseOriginalHandler('/opt/nodes/node_modules/handler.handler');
    expect(result).toEqual(['/opt/nodes/node_modules/handler', 'handler']);
  });

});
