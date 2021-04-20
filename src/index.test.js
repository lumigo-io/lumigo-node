/* eslint-disable */
import * as tracer from './tracer';
import * as utils from './utils';
import { EXECUTION_TAGS_KEY } from './utils';

import * as fsExtra from 'fs-extra';
import { AxiosMocker } from '../testUtils/axiosMocker';
import { MAX_ELEMENTS_IN_EXTRA } from './tracer';

describe('index', () => {
  const spies = {};
  spies.trace = jest.spyOn(tracer, 'trace');
  spies.setSwitchOff = jest.spyOn(utils, 'setSwitchOff');
  spies.setVerboseMode = jest.spyOn(utils, 'setVerboseMode');

  beforeEach(() => {
    Object.keys(spies).map(x => spies[x].mockClear());
  });

  test('execution tags - 2 versions of tracer - layer and manual', async () => {
    jest.setTimeout(15000);
    const originDirPath = __dirname;
    const dupDirPath = `${originDirPath}Dup'`;
    const layerPath = `${dupDirPath}/index.js`;

    const context = { getRemainingTimeInMillis: () => 30000 };
    const callback = jest.fn();
    const retVal = 'The Tracer Wars';

    try {
      await fsExtra.copy(originDirPath, dupDirPath);

      const lumigoLayer = require(layerPath)({ token: 'T' });
      const userHandler = async (event, context, callback) => {
        const lumigoManual = require('./index');
        lumigoManual.addExecutionTag('k0', 'v0');
        return retVal;
      };
      const result = await lumigoLayer.trace(userHandler)({}, context, callback);

      expect(result).toEqual(retVal);
      const sentSpans = AxiosMocker.getSentSpans()[1];
      const actualTags = sentSpans.filter(span => !span.id.endsWith('_started'))[0][
        EXECUTION_TAGS_KEY
      ];
      expect(actualTags).toEqual([{ key: 'k0', value: 'v0' }]);
    } finally {
      await fsExtra.remove(dupDirPath);
    }
  });

  test('execution tags - async handler', async () => {
    const context = { getRemainingTimeInMillis: () => 30000 };
    const callback = jest.fn();
    const retVal = 'The Tracer Wars';

    const lumigoImport = require('./index');
    const lumigo = lumigoImport({ token: 'T' });
    const userHandler = async (event, context, callback) => {
      // First way to run `addExecutionTag`, for manual tracing.
      lumigoImport.addExecutionTag('k0', 'v0');
      // Second way to run `addExecutionTag`, for auto tracing.
      lumigo.addExecutionTag('k1', 'v1');
      return retVal;
    };
    const result = await lumigo.trace(userHandler)({}, context, callback);

    expect(result).toEqual(retVal);
    const sentSpans = AxiosMocker.getSentSpans()[1];
    const actualTags = sentSpans.filter(span => !span.id.endsWith('_started'))[0][
      EXECUTION_TAGS_KEY
    ];
    expect(actualTags).toEqual([{ key: 'k0', value: 'v0' }, { key: 'k1', value: 'v1' }]);
  });

  const initLumigo = () => {
    const consoleLog = jest.spyOn(console, 'log');
    const lumigoImport = require('./index');
    const lumigo = lumigoImport({ token: 'T' });
    return { consoleLog, lumigo };
  };

  test('logs - error (should filter long entries and cut after the 10s element)', async () => {
    const { consoleLog, lumigo } = initLumigo();
    const longName = '1'.repeat(1000);
    let expected =
      '{"message":"This is error message","type":"ClientError","level":40,"extra":{"a":"3","b":"true","c":"aaa","d":"[object Object]","aa":"a","a0":"a0","a1":"a1","a2":"a2","a3":"a3","a4":"a4"}}';
    let extra = {
      a: 3,
      b: true,
      c: 'aaa',
      d: {},
      aa: 'a',
      [longName]: longName,
      ...Object.fromEntries([...Array(MAX_ELEMENTS_IN_EXTRA).keys()].map(k => [`a${k}`, `a${k}`])),
    };
    lumigo.error('This is error message', {
      type: 'ClientError',
      extra,
      err: new TypeError('This is type error'),
    });
    expect(consoleLog).toBeCalledWith(`[LUMIGO_LOG] ${expected}`);
  });

  test('err with type and exception', async () => {
    const { consoleLog, lumigo } = initLumigo();
    const expected =
      '{"message":"This is error message","type":"DBError","level":40,"extra":{"rawException":"This is type error"}}';
    lumigo.error('This is error message', {
      type: 'DBError',
      err: new TypeError('This is type error'),
    });
    expect(consoleLog).toBeCalledWith(`[LUMIGO_LOG] ${expected}`);
  });

  test('err with no type and exception', async () => {
    const { consoleLog, lumigo } = initLumigo();
    const expected =
      '{"message":"This is error message","type":"TypeError","level":40,"extra":{"rawException":"This is type error"}}';
    lumigo.error('This is error message', { err: new TypeError('This is type error') });
    expect(consoleLog).toBeCalledWith(`[LUMIGO_LOG] ${expected}`);
  });

  test('err with no type and no exception', async () => {
    const { consoleLog, lumigo } = initLumigo();
    const expected = '{"message":"This is error message","type":"ProgrammaticError","level":40}';
    lumigo.error('This is error message');
    expect(consoleLog).toBeCalledWith(`[LUMIGO_LOG] ${expected}`);
  });

  test('logs - (info,warn,error) (should use default type)', async () => {
    const { consoleLog, lumigo } = initLumigo();
    lumigo.info('This is error message');
    expect(consoleLog).toBeCalledWith(
      '[LUMIGO_LOG] {"message":"This is error message","type":"ProgrammaticInfo","level":20}'
    );
    lumigo.warn('This is error message');
    expect(consoleLog).toBeCalledWith(
      '[LUMIGO_LOG] {"message":"This is error message","type":"ProgrammaticWarn","level":30}'
    );
    lumigo.error('This is error message');
    expect(consoleLog).toBeCalledWith(
      '[LUMIGO_LOG] {"message":"This is error message","type":"ProgrammaticError","level":40}'
    );
  });

  test('execution tags - with undefined', async () => {
    const context = { getRemainingTimeInMillis: () => 30000 };

    const lumigoImport = require('./index');
    const lumigo = lumigoImport({ token: 'T' });
    const userHandler = async (event, context, callback) => {
      lumigoImport.addExecutionTag('k', undefined);
      return 'retVal';
    };
    const result = await lumigo.trace(userHandler)({}, context, jest.fn());

    expect(result).toEqual('retVal');
    const sentSpans = AxiosMocker.getSentSpans()[1];
    const actualTags = sentSpans.filter(span => !span.id.endsWith('_started'))[0][
      EXECUTION_TAGS_KEY
    ];
    expect(actualTags).toEqual([{ key: 'k', value: null }]);
  });

  test('execution tags - non async handler', async () => {
    const context = { getRemainingTimeInMillis: () => 30000 };

    const lumigoImport = require('./index');
    const lumigo = lumigoImport({ token: 'T' });
    const userHandler = (event, context, callback) => {
      // First way to run `addExecutionTag`, for manual tracing.
      lumigoImport.addExecutionTag('k0', 'v0');
      // Second way to run `addExecutionTag`, for auto tracing.
      lumigo.addExecutionTag('k1', 'v1');
      callback(null, 'OK');
    };
    await lumigo.trace(userHandler)({}, context, jest.fn());

    const sentSpans = AxiosMocker.getSentSpans()[1];
    const actualTags = sentSpans.filter(span => !span.id.endsWith('_started'))[0][
      EXECUTION_TAGS_KEY
    ];
    expect(actualTags).toEqual([{ key: 'k0', value: 'v0' }, { key: 'k1', value: 'v1' }]);
  });

  test('addExecutionTag without tracer not throw exception', async () => {
    const lumigoImport = require('./index');
    lumigoImport.addExecutionTag('k0', 'v0');
    // No exception.
    const lumigo = lumigoImport({ token: 't' });
    lumigo.addExecutionTag('k0', 'v0');
    // No exception.
  });

  test('init tracer', () => {
    const retVal = 1234;
    spies.trace.mockReturnValueOnce(retVal);

    const token = 'DEADBEEF';
    const debug = false;
    const edgeHost = 'zarathustra.com';
    const verbose = true;

    const lumigo1 = require('./index')({ token, edgeHost, verbose });
    expect(lumigo1.trace).toEqual(retVal);
    expect(spies.trace).toHaveBeenCalledWith({
      debug,
      token,
      edgeHost,
      switchOff: false,
      eventFilter: {},
      stepFunction: false,
    });
    expect(spies.setVerboseMode).toHaveBeenCalled();
    spies.trace.mockClear();
    spies.trace.mockReturnValueOnce(retVal);
    const lumigo2 = require('./index')({
      token,
      switchOff: true,
    });
    expect(lumigo2.trace).toEqual(retVal);
    expect(spies.trace).toHaveBeenCalledWith({
      debug,
      token,
      edgeHost: undefined,
      switchOff: true,
      eventFilter: {},
      stepFunction: false,
    });
    expect(spies.setSwitchOff).toHaveBeenCalled();
  });

  test('init backward compatbility with older tracer', () => {
    const retVal = 1234;
    spies.trace.mockReturnValueOnce(retVal);

    const LumigoTracer = require('./index');
    const token = 'DEADBEEF';
    const debug = false;
    const edgeHost = 'zarathustra.com';

    const retTracer = new LumigoTracer({ token, edgeHost });
    expect(retTracer.trace).toEqual(retVal);
    expect(spies.trace).toHaveBeenCalledWith({
      token,
      debug,
      edgeHost,
      switchOff: false,
      eventFilter: {},
      stepFunction: false,
    });
  });
});
