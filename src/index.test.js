/* eslint-disable */
import * as tracer from './tracer';
import * as utils from './utils';
import { EXECUTION_TAGS_KEY } from './utils';

describe('index', () => {
  const spies = {};
  spies.trace = jest.spyOn(tracer, 'trace');
  spies.setSwitchOff = jest.spyOn(utils, 'setSwitchOff');
  spies.setVerboseMode = jest.spyOn(utils, 'setVerboseMode');

  beforeEach(() => {
    Object.keys(spies).map(x => spies[x].mockClear());
  });

  test('execution tags', async () => {
    const context = { getRemainingTimeInMillis: () => 30000 };
    const callback = jest.fn();
    const retVal = 'The Tracer Wars';
    const token = 'DEADBEEF';
    let sentSpans = [];
    jest.spyOn(utils, 'httpReq').mockImplementation((options, reqBody) => {
      sentSpans = [...sentSpans, ...JSON.parse(reqBody)];
    });

    const lumigo_import = require('./index');
    const lumigo = lumigo_import({ token });
    const userHandler = async (event, context, callback) => {
      // First way to run `addExecutionTag`, for manual tracing.
      lumigo_import.addExecutionTag('k0', 'v0');
      // Second way to run `addExecutionTag`, for auto tracing.
      lumigo.addExecutionTag('k1', 'v1');
      return retVal;
    };
    const result = await lumigo.trace(userHandler)({}, context, callback);

    expect(result).toEqual(retVal);
    const actualTags = sentSpans.filter(
      span => !span.id.endsWith('_started')
    )[0][EXECUTION_TAGS_KEY];
    expect(actualTags).toEqual([
      { key: 'k0', value: 'v0' },
      { key: 'k1', value: 'v1' },
    ]);
  });

  test('addExecutionTag without tracer not throw exception', async () => {
    const lumigo_import = require('./index');
    lumigo_import.addExecutionTag('k0', 'v0');
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
