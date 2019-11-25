/* eslint-disable */
import * as tracer from './tracer';
import * as utils from './utils';
import { LUMIGO_REPORT_ERROR_STRING } from './utils';
import * as logger from './logger';

describe('index', () => {
  const spies = {};
  spies.trace = jest.spyOn(tracer, 'trace');
  spies.log = jest.spyOn(console, 'log');
  spies.debug = jest.spyOn(console, 'debug');
  spies.setSwitchOff = jest.spyOn(utils, 'setSwitchOff');
  spies.setVerboseMode = jest.spyOn(utils, 'setVerboseMode');

  beforeEach(() => {
    Object.keys(spies).map(x => spies[x].mockClear());
  });

  test('report error', () => {
    const token = 'DEADBEEF';
    const edgeHost = 'zarathustra.com';
    const verbose = true;
    const lumigo = require('./index')({ token, edgeHost, verbose });
    let msg = 'oh no! - an error';
    lumigo.reportError(msg);
    expect(spies.log).toHaveBeenCalledWith(LUMIGO_REPORT_ERROR_STRING, msg);

    let obj_msg = {};
    lumigo.reportError(obj_msg);
    expect(spies.log).toHaveBeenCalledWith(LUMIGO_REPORT_ERROR_STRING, obj_msg);

    let throws_msg = {};
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {
      throw new Error();
    });
    lumigo.reportError(throws_msg);
    spy.mockRestore();
    expect(spies.debug).toHaveBeenCalledWith(
      'failed to print using reportError',
      { msg: {} }
    );
  });

  test('init tracer', () => {
    const retVal = 1234;
    spies.trace.mockReturnValueOnce(retVal);

    const token = 'DEADBEEF';
    const debug = false;
    const edgeHost = 'zarathustra.com';
    const verbose = true;

    const lumigo1 = require('./index')({ token, edgeHost, verbose });
    expect(spies.trace).toHaveBeenCalledWith({
      debug,
      token,
      edgeHost,
      switchOff: false,
      eventFilter: {},
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
      edgeHost: '',
      switchOff: true,
      eventFilter: {},
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
    });
  });
});
