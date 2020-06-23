/* eslint-disable */
import * as tracer from './tracer';
import * as utils from './utils';
import { EXECUTION_TAGS_KEY } from './utils';
import { HttpsRequestsForTesting } from '../testUtils/httpsMocker';
import * as fsExtra from 'fs-extra';

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
      const result = await lumigoLayer.trace(userHandler)(
        {},
        context,
        callback
      );

      expect(result).toEqual(retVal);
      const actualTags = HttpsRequestsForTesting.getSentSpans().filter(
        span => !span.id.endsWith('_started')
      )[0][EXECUTION_TAGS_KEY];
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
    const actualTags = HttpsRequestsForTesting.getSentSpans().filter(
      span => !span.id.endsWith('_started')
    )[0][EXECUTION_TAGS_KEY];
    expect(actualTags).toEqual([
      { key: 'k0', value: 'v0' },
      { key: 'k1', value: 'v1' },
    ]);
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

    const actualTags = HttpsRequestsForTesting.getSentSpans().filter(
      span => !span.id.endsWith('_started')
    )[0][EXECUTION_TAGS_KEY];
    expect(actualTags).toEqual([
      { key: 'k0', value: 'v0' },
      { key: 'k1', value: 'v1' },
    ]);
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
