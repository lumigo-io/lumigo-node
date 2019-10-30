/* eslint-disable */
import * as tracer from './tracer';
import * as utils from './utils';
import * as globals from './globals';
import * as reporter from './reporter';
import * as awsSpan from './spans/awsSpan';
import startHooks from './hooks';
import * as logger from './logger';
import { shouldSetTimeoutTimer } from './utils';
import { TracerGlobals } from './globals';

jest.mock('./hooks');
describe('tracer', () => {
  const spies = {};
  spies.isSwitchedOff = jest.spyOn(utils, 'isSwitchedOff');
  spies.isAwsEnvironment = jest.spyOn(utils, 'isAwsEnvironment');
  spies.isSendOnlyIfErrors = jest.spyOn(utils, 'isSendOnlyIfErrors');
  spies.shouldSetTimeoutTimer = jest.spyOn(utils, 'shouldSetTimeoutTimer');
  spies.getContextInfo = jest.spyOn(utils, 'getContextInfo');
  spies.sendSingleSpan = jest.spyOn(reporter, 'sendSingleSpan');
  spies.sendSpans = jest.spyOn(reporter, 'sendSpans');
  spies.getFunctionSpan = jest.spyOn(awsSpan, 'getFunctionSpan');
  spies.getEndFunctionSpan = jest.spyOn(awsSpan, 'getEndFunctionSpan');
  spies.addRttToFunctionSpan = jest.spyOn(awsSpan, 'addRttToFunctionSpan');
  spies.getCurrentTransactionId = jest.spyOn(awsSpan, 'getCurrentTransactionId');
  spies.SpansContainer = {};
  spies.SpansContainer.getSpans = jest.spyOn(
    globals.SpansContainer,
    'getSpans'
  );
  spies.SpansContainer.clearSpans = jest.spyOn(
    globals.SpansContainer,
    'clearSpans'
  );
  spies.SpansContainer.addSpan = jest.spyOn(globals.SpansContainer, 'addSpan');
  spies.clearGlobals = jest.spyOn(globals, 'clearGlobals');
  spies.warnClient = jest.spyOn(logger, 'warnClient');
  spies.logFatal = jest.spyOn(logger, 'fatal');

  beforeEach(() => {
    startHooks.mockClear();
    Object.keys(spies).map(
      x => typeof x === 'function' && spies[x].mockClear()
    );
  });
  test('startTrace', async () => {
    spies.isSwitchedOff.mockReturnValueOnce(false);
    spies.isAwsEnvironment.mockReturnValueOnce(true);

    const rtt = 1234;
    spies.sendSingleSpan.mockReturnValueOnce({ rtt });
    spies.shouldSetTimeoutTimer.mockReturnValueOnce(false);

    const functionSpan = { a: 'b', c: 'd' };
    spies.getFunctionSpan.mockReturnValueOnce(functionSpan);

    const retVal = 'Satoshi was here';
    spies.addRttToFunctionSpan.mockReturnValueOnce(retVal);

    const result1 = await tracer.startTrace();
    expect(result1).toEqual(retVal);

    expect(spies.isSwitchedOff).toHaveBeenCalled();
    expect(spies.isAwsEnvironment).toHaveBeenCalled();
    expect(spies.getFunctionSpan).toHaveBeenCalled();
    expect(spies.sendSingleSpan).toHaveBeenCalledWith(functionSpan);
    expect(spies.addRttToFunctionSpan).toHaveBeenCalledWith(functionSpan, rtt);

    spies.isAwsEnvironment.mockReturnValueOnce(false);
    spies.isSwitchedOff.mockReturnValueOnce(false);

    const result2 = await tracer.startTrace();
    expect(result2).toEqual(null);

    spies.logFatal.mockImplementationOnce(() => {});
    const err1 = new Error('stam1');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err1;
    });

    await expect(tracer.startTrace()).resolves.toEqual(null);
    expect(spies.logFatal).toHaveBeenCalledWith('startTrace failure', err1);

    //Test - isSendOnlyIfErrors is on, start span in not sent or saved to the spans list
    spies.sendSingleSpan.mockClear();
    spies.isSwitchedOff.mockClear();
    spies.getFunctionSpan.mockReturnValueOnce(functionSpan);
    spies.isAwsEnvironment.mockReturnValueOnce(true);
    spies.isSendOnlyIfErrors.mockReturnValueOnce(true);
    await expect(tracer.startTrace()).resolves.toEqual(null);

    expect(spies.sendSingleSpan).toHaveBeenCalledTimes(0);
    expect(spies.SpansContainer.addSpan).toHaveBeenCalledTimes(0);
  });

  test('isCallbacked', async () => {
    expect(tracer.isCallbacked({ type: tracer.HANDLER_CALLBACKED })).toBe(true);
    expect(tracer.isCallbacked({ type: tracer.HANDLER_CALLBACKED })).toBe(true);
    expect(tracer.isCallbacked({ type: tracer.ASYNC_HANDLER_RESOLVED })).toBe(
      false
    );
  });

  test('endTrace; callbackWaitsForEmptyEventLoop is false', async () => {
    spies.isSwitchedOff.mockReturnValueOnce(false);
    spies.isAwsEnvironment.mockReturnValueOnce(true);

    const rtt = 1234;
    spies.sendSpans.mockImplementationOnce(() => {});

    const dummySpan = { x: 'y' };
    const functionSpan = { a: 'b', c: 'd' };
    const handlerReturnValue = 'Satoshi was here1';
    const endFunctionSpan = { a: 'b', c: 'd', rtt };

    spies.getContextInfo.mockReturnValueOnce({
      callbackWaitsForEmptyEventLoop: false,
    });

    const spans = [dummySpan, endFunctionSpan];
    spies.SpansContainer.getSpans.mockReturnValueOnce(spans);
    spies.getEndFunctionSpan.mockReturnValueOnce(endFunctionSpan);

    const result1 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result1).toEqual(undefined);

    expect(spies.isSwitchedOff).toHaveBeenCalled();
    expect(spies.isAwsEnvironment).toHaveBeenCalled();
    expect(spies.getEndFunctionSpan).toHaveBeenCalledWith(
      functionSpan,
      handlerReturnValue
    );
    expect(spies.sendSpans).toHaveBeenCalledWith(spans);
    expect(spies.clearGlobals).toHaveBeenCalled();

    spies.isAwsEnvironment.mockReturnValueOnce(false);
    spies.isSwitchedOff.mockReturnValueOnce(false);

    const result2 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result2).toEqual(undefined);
    expect();

    spies.clearGlobals.mockClear();

    spies.logFatal.mockImplementationOnce(() => {});
    const err2 = new Error('stam2');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err2;
    });

    await tracer.endTrace(functionSpan, handlerReturnValue);

    expect(spies.logFatal).toHaveBeenCalledWith('endTrace failure', err2);
    expect(spies.clearGlobals).toHaveBeenCalled();
  });

  test('endTrace; callbackWaitsForEmptyEventLoop is true', async () => {
    spies.isSwitchedOff.mockReturnValueOnce(false);
    spies.isAwsEnvironment.mockReturnValueOnce(true);

    const rtt = 1234;
    spies.sendSpans.mockImplementationOnce(() => {});

    const dummySpan = { x: 'y' };
    const functionSpan = { a: 'b', c: 'd' };
    const handlerReturnValue = { type: tracer.HANDLER_CALLBACKED };
    const endFunctionSpan = { a: 'b', c: 'd', rtt };

    spies.getContextInfo.mockReturnValueOnce({
      callbackWaitsForEmptyEventLoop: true,
    });
    const callAfterEmptyEventLoopSpy = jest.spyOn(
      utils,
      'callAfterEmptyEventLoop'
    );
    callAfterEmptyEventLoopSpy.mockReturnValueOnce(null);

    const spans = [dummySpan, endFunctionSpan];
    spies.SpansContainer.getSpans.mockReturnValueOnce(spans);
    spies.getEndFunctionSpan.mockReturnValueOnce(endFunctionSpan);

    const result1 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result1).toEqual(undefined);

    expect(callAfterEmptyEventLoopSpy).toHaveBeenCalledWith(
      tracer.sendEndTraceSpans,
      [functionSpan, handlerReturnValue]
    );
    expect(spies.isSwitchedOff).toHaveBeenCalled();
    expect(spies.isAwsEnvironment).toHaveBeenCalled();

    spies.isAwsEnvironment.mockReturnValueOnce(false);
    spies.isSwitchedOff.mockReturnValueOnce(false);

    const result2 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result2).toEqual(undefined);

    spies.clearGlobals.mockClear();

    spies.logFatal.mockImplementationOnce(() => {});
    const err2 = new Error('stam2');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err2;
    });

    await tracer.endTrace(functionSpan, handlerReturnValue);

    expect(spies.logFatal).toHaveBeenCalledWith('endTrace failure', err2);
    expect(spies.clearGlobals).toHaveBeenCalled();
  });

  test('callbackResolver', () => {
    const resolve = jest.fn();
    const err = 'err';
    const data = 'data';
    const type = tracer.HANDLER_CALLBACKED;
    tracer.callbackResolver(resolve)(err, data);
    expect(resolve).toHaveBeenCalledWith({ err, data, type });
  });

  test('timeout does not activated in short functions', () => {
    spies.shouldSetTimeoutTimer.mockReturnValueOnce(true);
    spies.getContextInfo.mockReturnValueOnce({
      remainingTimeInMillis: 100,
    });
    expect(tracer.startTimeoutTimer()).toEqual(null);
  });

  test('timeout sends http spans and clear the queue', async () => {
    spies.shouldSetTimeoutTimer.mockReturnValueOnce(true);
    spies.getContextInfo.mockReturnValueOnce({
      remainingTimeInMillis: 3000,
    });
    const timeout = tracer.startTimeoutTimer();
    expect(timeout._idleTimeout).toEqual(2500);
    await timeout._onTimeout();
    expect(spies.SpansContainer.getSpans).toHaveBeenCalled();
    expect(spies.SpansContainer.clearSpans).toHaveBeenCalled();
    clearTimeout(timeout);
  });

  test('promisifyUserHandler async ', async () => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const data = 'Satoshi was here';
    const err = new Error('w00t');
    const userHandler1 = async () => Promise.resolve(data);
    expect(
      tracer.promisifyUserHandler(userHandler1, event, context)
    ).resolves.toEqual({
      err: null,
      data,
      type: tracer.ASYNC_HANDLER_RESOLVED,
    });

    const userHandler2 = async () => Promise.reject(err);
    expect(
      tracer.promisifyUserHandler(userHandler2, event, context)
    ).resolves.toEqual({
      err,
      data: null,
      type: tracer.ASYNC_HANDLER_REJECTED,
    });

    const userHandler3 = async (event, context, callback) => {
      const err = null;
      const data = 'async callbacked?';
      callback(err, data);
    };
    expect(
      tracer.promisifyUserHandler(userHandler3, event, context)
    ).resolves.toEqual({
      err: null,
      data: 'async callbacked?',
      type: tracer.HANDLER_CALLBACKED,
    });
  });

  test('promisifyUserHandler non async', async () => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const err = new Error('w00t');

    const userHandler1 = () => {
      throw err;
    };
    expect(
      tracer.promisifyUserHandler(userHandler1, event, context)
    ).resolves.toEqual({
      err,
      data: null,
      type: tracer.NON_ASYNC_HANDLER_ERRORED,
    });

    const userHandler2 = (event, context, callback) => {
      const err = null;
      const data = 'non async callbacked?';
      callback(err, data);
    };
    await expect(
      tracer.promisifyUserHandler(userHandler2, event, context)
    ).resolves.toEqual({
      err: null,
      data: 'non async callbacked?',
      type: tracer.HANDLER_CALLBACKED,
    });
  });

  test('trace; non async callbacked', async done => {
    const retVal = 'The Tracer Wars';
    const userHandler1 = (event, context, callback) => callback(null, retVal);
    const callback1 = (err, data) => {
      expect(data).toEqual(retVal);
      done();
    };

    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    const token = 'DEADBEEF';

    spies.isSwitchedOff.mockReturnValue(true);
    await tracer.trace({ token })(userHandler1)(event, context, callback1);

    expect(startHooks).toHaveBeenCalled();
  });

  test('trace; non async throw error', async () => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const token = 'DEADBEEF';

    spies.isSwitchedOff.mockReturnValue(true);
    const userHandler2 = (event, context, callback) => {
      throw new Error('bla');
    };
    const callback2 = jest.fn();
    await expect(
      tracer.trace({ token })(userHandler2)(event, context, callback2)
    ).rejects.toEqual(new Error('bla'));

    expect(startHooks).toHaveBeenCalled();
  });

  test('trace; async callbacked ', async done => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const token = 'DEADBEEF';

    const retVal = 'The Tracer Wars';
    const callback3 = (err, data) => {
      expect(data).toEqual(retVal);
      done();
    };

    spies.isSwitchedOff.mockReturnValue(true);

    const userHandler3 = async (event, context, callback) => {
      callback(null, retVal);
    };
    await tracer.trace({ token })(userHandler3)(event, context, callback3);
  });

  test('trace; async resolved ', async () => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const token = 'DEADBEEF';

    const retVal = 'The Tracer Wars';
    const callback4 = jest.fn();

    spies.isSwitchedOff.mockReturnValue(true);

    const userHandler4 = async (event, context, callback) => {
      return retVal;
    };
    await expect(
      tracer.trace({ token })(userHandler4)(event, context, callback4)
    ).resolves.toEqual(retVal);

    expect(startHooks).toHaveBeenCalled();
  });

  test('trace; async rejected', async () => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const token = 'DEADBEEF';

    const retVal = 'The Tracer Wars';
    const callback5 = jest.fn();

    spies.isSwitchedOff.mockReturnValue(true);

    const userHandler5 = async (event, context, callback) => {
      throw new Error(retVal);
    };
    await expect(
      tracer.trace({ token })(userHandler5)(event, context, callback5)
    ).rejects.toEqual(new Error(retVal));

    expect(startHooks).toHaveBeenCalled();
  });

  test('sendEndTraceSpans; dont clear globals in case of a leak', async () => {
    spies.sendSpans.mockImplementation(() => {});
    spies.getEndFunctionSpan.mockReturnValue({x: 'y'});
    spies.getCurrentTransactionId.mockReturnValue("123");

    TracerGlobals.setTracerInputs({ token: "123" });
    spies.SpansContainer.getSpans.mockReturnValueOnce([{transactionId: "123", id: "1"}, {transactionId: "123", id: "2"}]);
    await tracer.sendEndTraceSpans({ id: "1_started" }, {err: null, data: null});
    expect(spies.warnClient).not.toHaveBeenCalled();
    expect(TracerGlobals.getTracerInputs().token).toEqual("");

    TracerGlobals.setTracerInputs({ token: "123" });
    spies.SpansContainer.getSpans.mockReturnValueOnce([{transactionId: "123", id: "1"}, {transactionId: "456", id: "2"}]);
    await tracer.sendEndTraceSpans({ id: "1_started" }, {err: null, data: null});
    expect(spies.warnClient).toHaveBeenCalled();
    expect(TracerGlobals.getTracerInputs().token).toEqual("123");
  });
});
