/* eslint-disable */
import * as logger from './logger';
import * as utils from './utils';

jest.spyOn(global.console, 'log');
global.console.log.mockImplementation(() => {});

describe('logger', () => {
  const spies = {};
  const oldEnv = Object.assign({}, process.env);
  spies.log = jest.spyOn(logger, 'log');

  beforeEach(() => {
    global.console.log.mockClear();
    spies.log.mockClear();
    process.env = { ...oldEnv };
  });

  test('info', () => {
    utils.setDebug();
    logger.info();
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith('INFO', undefined, undefined);
  });

  test('debug', () => {
    utils.setDebug();
    logger.debug();
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith('DEBUG', undefined, undefined);
  });

  test('warn', () => {
    utils.setDebug();
    logger.warn();
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith('WARNING', undefined, undefined);
  });

  test('fatal', () => {
    utils.setDebug();
    logger.fatal();
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith('FATAL', undefined, undefined);
  });

  test('invokeLog', () => {
    const oldEnv = Object.assign({}, process.env);
    const logLevel = 'LOG_LEVEL';
    const logMessage = 'info test';
    const logObject = 1;

    const typedInvokeLogFn = logger.invokeLog(logLevel);
    expect(typedInvokeLogFn).toBeInstanceOf(Function);
    typedInvokeLogFn();
    expect(spies.log).toHaveBeenCalledTimes(0);

    utils.setDebug();

    expect(typedInvokeLogFn).toBeInstanceOf(Function);

    typedInvokeLogFn(logMessage);
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith(logLevel, logMessage, undefined);

    spies.log.mockClear();
    typedInvokeLogFn(logMessage, logObject);
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith(logLevel, logMessage, logObject);

    process.env = { ...oldEnv };
  });

  test('log', () => {
    const logMessage = 'info test';
    const logLevel = 'LOG_LEVEL';
    const logObject = 1;

    logger.log(logLevel, logMessage, undefined);
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      `#LUMIGO# - ${logLevel} - "${logMessage}"`
    );

    global.console.log.mockClear();
    logger.log(logLevel, logMessage, logObject);
    expect(global.console.log).toHaveBeenCalledTimes(1);
    expect(global.console.log).toHaveBeenCalledWith(
      `#LUMIGO# - ${logLevel} - "${logMessage}"`,
      `${logObject}`
    );
  });

  test('lumigoWarnings; not print to the console if the environment variable exists', () => {
    process.env.LUMIGO_WARNINGS = 'off';
    expect(logger.warnClient('msg')).toEqual(false);

    process.env.LUMIGO_WARNINGS = undefined;
    expect(logger.warnClient('msg')).toEqual(true);
  });

  test('isDebug', () => {
    expect(logger.isDebug()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_DEBUG: 'TRUE' };
    expect(logger.isDebug()).toBe(true);
    process.env = { ...oldEnv };
  });
});
