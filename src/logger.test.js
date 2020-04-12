import * as logger from './logger';
import * as utils from './utils';
import { TracerGlobals } from './globals';
import { ConsoleWritesForTesting } from '../testUtils/consoleMocker';

describe('logger', () => {
  test('info -> simple flow', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.info('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - INFO - "Test"',
        obj: undefined,
      },
    ]);
  });

  test('info -> with object', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.info('Test', { a: 2 });
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - INFO - "Test"',
        obj: '{"a":2}',
      },
    ]);
  });

  test('info -> debug is off', () => {
    TracerGlobals.setTracerInputs({});
    logger.info('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([]);
  });

  test('debug -> simple flow', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.debug('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - DEBUG - "Test"',
        obj: undefined,
      },
    ]);
  });

  test('debug -> debug is off', () => {
    TracerGlobals.setTracerInputs({});
    logger.debug('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([]);
  });

  test('debug -> with object', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.debug('Test', { a: 2 });
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - DEBUG - "Test"',
        obj: '{"a":2}',
      },
    ]);
  });

  test('warn -> simple flow', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.warn('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - WARNING - "Test"',
        obj: undefined,
      },
    ]);
  });

  test('warn -> debug is off', () => {
    TracerGlobals.setTracerInputs({});
    logger.warn('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([]);
  });

  test('warn -> with object', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.warn('Test', { a: 2 });
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - WARNING - "Test"',
        obj: '{"a":2}',
      },
    ]);
  });

  test('fatal -> simple flow', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.fatal('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - FATAL - "Test"',
        obj: undefined,
      },
    ]);
  });

  test('fatal -> debug is off', () => {
    TracerGlobals.setTracerInputs({});
    logger.fatal('Test');
    expect(ConsoleWritesForTesting.getLogs()).toEqual([]);
  });

  test('fatal -> with object', () => {
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    logger.fatal('Test', { a: 2 });
    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: '#LUMIGO# - FATAL - "Test"',
        obj: '{"a":2}',
      },
    ]);
  });

  test('lumigoWarnings; not print to the console if the environment variable exists', () => {
    process.env.LUMIGO_WARNINGS = 'off';
    expect(logger.warnClient('msg')).toEqual(false);

    process.env.LUMIGO_WARNINGS = undefined;
    expect(logger.warnClient('msg')).toEqual(true);
  });
});
