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
    logger.resetLogger();
  });

  test('default isEmergencyMode is off', () => {
    const isEmergencyMode = logger.isEmergencyMode();
    expect(isEmergencyMode).toBe(false);
  });

  test('safePrint print same log just once', () => {
    utils.setDebug();
    const logSet = new Set([]);
    logger.safePrint(logSet, 'INFO', 'msg', {});
    logger.safePrint(logSet, 'INFO', 'msg', {});
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith('INFO', 'msg', {});
  });

  test('safePrint print different log', () => {
    utils.setDebug();
    const logSet = new Set([]);
    logger.safePrint(logSet, 'INFO', 'msg - 1', {});
    logger.safePrint(logSet, 'INFO', 'msg - 2', {});
    expect(spies.log).toHaveBeenCalledTimes(2);
    expect(spies.log).toHaveBeenCalledWith('INFO', 'msg - 1', {});
    expect(spies.log).toHaveBeenCalledWith('INFO', 'msg - 2', {});
  });

  test('safePrint updated isEmergencyMode', () => {
    utils.setDebug();
    const logSet = new Set([]);
    logger.safePrint(logSet, 'INFO', 'msg', {});
    logger.safePrint(logSet, 'INFO', 'msg', {});
    logger.safePrint(logSet, 'INFO', 'msg', {});
    logger.safePrint(logSet, 'INFO', 'msg', {});
    const isEmergencyMode = logger.isEmergencyMode();
    expect(isEmergencyMode).toBe(true);
  });

  test('printPendingLogs', () => {
    const pendingSet = new Set([
      {
        type: 'INFO',
        message: 'msg',
        obj: {},
      },
    ]);
    const printedSet = new Set([]);
    logger.printPendingLogs(pendingSet, printedSet);
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(pendingSet.size).toBe(0);
    expect(printedSet.size).toBe(1);
  });

  test('buildLogObject', () => {
    const result = logger.buildLogObject('type', 'message', {});
    expect(result).toEqual({
      type: 'type',
      message: 'message',
      obj: {},
    });
  });

  test('handlePendingLogs add log to pending list if needed', () => {
    const pendingSet = new Set([]);
    const printedSet = new Set([]);
    const logObj = {
      type: 'type',
      msg: 'msg',
      obj: {},
    };
    logger.handlePendingLogs(pendingSet, printedSet, logObj);
    expect(pendingSet.size).toBe(1);
    expect(printedSet.size).toBe(0);
    expect(pendingSet.has(JSON.stringify(logObj))).toBe(true);
  });

  test('handlePendingLogs dont add log to pending list if not needed', () => {
    const logObj = {
      type: 'type',
      msg: 'msg',
      obj: {},
    };
    const pendingSet = new Set([]);
    const printedSet = new Set([JSON.stringify(logObj)]);
    logger.handlePendingLogs(pendingSet, printedSet, logObj);
    expect(pendingSet.size).toBe(0);
    expect(printedSet.size).toBe(1);
  });

  test('handlePendingLogs updated isEmergencyMode', () => {
    const logObj = {
      type: 'type',
      msg: 'msg',
      obj: {},
    };
    const pendingSet = new Set([]);
    const printedSet = new Set([JSON.stringify(logObj)]);
    logger.handlePendingLogs(pendingSet, printedSet, logObj);
    logger.handlePendingLogs(pendingSet, printedSet, logObj);
    logger.handlePendingLogs(pendingSet, printedSet, logObj);
    logger.handlePendingLogs(pendingSet, printedSet, logObj);
    const isEmergencyMode = logger.isEmergencyMode();
    expect(isEmergencyMode).toBe(true);
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
});
