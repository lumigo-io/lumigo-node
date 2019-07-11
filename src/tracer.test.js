/* eslint-disable */
import * as tracer from './tracer';
import * as utils from './utils';
import * as globals from './globals';
import * as reporter from './reporter';
import * as awsSpan from './spans/awsSpan';
import startHooks from './hooks';

jest.mock('./hooks');
describe('tracer', () => {
  const spies = {};
  spies.isSwitchedOff = jest.spyOn(utils, 'isSwitchedOff');
  spies.isAwsEnvironment = jest.spyOn(utils, 'isAwsEnvironment');
  spies.sendSingleSpan = jest.spyOn(reporter, 'sendSingleSpan');
  spies.sendSpans = jest.spyOn(reporter, 'sendSpans');
  spies.getFunctionSpan = jest.spyOn(awsSpan, 'getFunctionSpan');
  spies.getEndFunctionSpan = jest.spyOn(awsSpan, 'getEndFunctionSpan');
  spies.addRttToFunctionSpan = jest.spyOn(awsSpan, 'addRttToFunctionSpan');
  spies.SpansContainer = {};
  spies.SpansContainer.getSpans = jest.spyOn(
    globals.SpansContainer,
    'getSpans'
  );
  spies.SpansContainer.addSpan = jest.spyOn(globals.SpansContainer, 'addSpan');
  spies.clearGlobals = jest.spyOn(globals, 'clearGlobals');
  spies.log = jest.spyOn(console, 'log');

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

    spies.log.mockImplementationOnce(() => {});
    const err1 = new Error('stam1');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err1;
    });

    await expect(tracer.startTrace()).resolves.toEqual(null);
    expect(spies.log).toHaveBeenCalledWith(
      '#LUMIGO#',
      'startTrace failure',
      err1
    );
  });

  test('endTrace', async () => {
    spies.isSwitchedOff.mockReturnValueOnce(false);
    spies.isAwsEnvironment.mockReturnValueOnce(true);

    const rtt = 1234;
    spies.sendSpans.mockImplementationOnce(() => {});

    const dummySpan = { x: 'y' };
    const functionSpan = { a: 'b', c: 'd' };
    const handlerReturnValue = 'Satoshi was here1';
    const endFunctionSpan = { a: 'b', c: 'd', rtt };

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

    spies.clearGlobals.mockClear();

    spies.log.mockImplementationOnce(() => {});
    const err2 = new Error('stam2');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err2;
    });

    await tracer.endTrace(functionSpan, handlerReturnValue);

    expect(spies.log).toHaveBeenCalledWith(
      '#LUMIGO#',
      'endTrace failure',
      err2
    );
    expect(spies.clearGlobals).toHaveBeenCalled();
  });

  test('asyncCallbackResolver', () => {
    const resolve = jest.fn();
    const err = 'err';
    const data = 'data';
    const type = tracer.ASYNC_HANDLER_CALLBACKED;
    tracer.asyncCallbackResolver(resolve)(err, data);
    expect(resolve).toHaveBeenCalledWith({ err, data, type });
  });

  test('nonAsyncCallbackResolver', () => {
    const resolve = jest.fn();
    const err = 'err';
    const data = 'data';
    const type = tracer.NON_ASYNC_HANDLER_CALLBACKED;
    tracer.nonAsyncCallbackResolver(resolve)(err, data);
    expect(resolve).toHaveBeenCalledWith({ err, data, type });
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
      type: tracer.ASYNC_HANDLER_CALLBACKED,
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
      type: tracer.NON_ASYNC_HANDLER_CALLBACKED,
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
});
