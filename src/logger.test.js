/* eslint-disable */
import * as logger from './logger';
import * as utils from './utils';

jest.spyOn(global.console, 'log');
global.console.log.mockImplementation(() => {});

// const Console = console;
// Console.log = jest.fn(x => x + 1);

describe('logger', () => {
  const spies = {};
  spies.log = jest.spyOn(logger, 'log');

  beforeEach(() => {
    global.console.log.mockClear();
  });

  test('info', () => {
    const retVal = 'dori was here';
    spies.log.mockReturnValueOnce(retVal);

    const infoInput = 'info test';
    logger.info(infoInput);
    expect(spies.log).toHaveBeenCalledWith(infoInput, undefined);
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith('#LUMIGO# - INFO - "Test"');

    global.console.log.mockClear();
    logger.info('Test', 1);
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - INFO - "Test"',
      '1'
    );
  });

  test('debug', () => {
    const oldEnv = Object.assign({}, process.env);
    const debug = utils.isDebug();
    logger.debug('Test', 1);
    expect(global.console.log).toHaveBeenCalledTimes(0);

    utils.setIsDebug();
    logger.debug('Test');
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - DEBUG - "Test"'
    );

    global.console.log.mockClear();
    logger.debug('Test', 1);
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - DEBUG - "Test"',
      '1'
    );

    process.env = { ...oldEnv };
  });

  test('warn', () => {
    logger.warn('Test');
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - WARNING - "Test"'
    );

    global.console.log.mockClear();
    logger.warn('Test', 1);
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - WARNING - "Test"',
      '1'
    );
  });

  test('fatal', () => {
    logger.fatal('Test');
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - FATAL - "Test"'
    );

    global.console.log.mockClear();
    logger.fatal('Test', 1);
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - FATAL - "Test"',
      '1'
    );
  });
});
