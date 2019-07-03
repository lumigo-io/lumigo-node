/* eslint-disable */
import * as logger from './logger';
import * as utils from './utils';

jest.spyOn(global.console, 'log');
global.console.log.mockImplementation(() => {});

// const Console = console;
// Console.log = jest.fn(x => x + 1);

describe('logger', () => {
  test('info', () => {
    global.console.log.mockClear();
    logger.info('Test');
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith('#LUMIGO# - INFO - "Test"');
  });

  test('debug', () => {
    global.console.log.mockClear();
    const oldEnv = Object.assign({}, process.env);
    const debug = utils.isDebug();
    logger.debug('Test');
    expect(global.console.log).toHaveBeenCalledTimes(0);

    utils.setIsDebug();
    logger.debug('Test');
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - DEBUG - "Test"'
    );

    process.env = { ...oldEnv };
  });

  test('warn', () => {
    global.console.log.mockClear();
    logger.warn('Test');
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - WARNING - "Test"'
    );
  });

  test('fatal', () => {
    global.console.log.mockClear();
    logger.fatal('Test');
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      '#LUMIGO# - FATAL - "Test"'
    );
  });
});
