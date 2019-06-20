import * as tracer from './tracer';
import * as utils from './utils';
import * as globals from './globals';
import * as reporter from './reporter';
import * as awsSpan from './spans/awsSpan';

describe('tracer', () => {
  const spies = {};
  spies.isSwitchedOff = jest.spyOn(utils, 'isSwitchedOff');
  spies.isAwsEnvironment = jest.spyOn(utils, 'isAwsEnvironment');
  spies.sendSingleSpan = jest.spyOn(reporter, 'sendSingleSpan');
  spies.sendSpans = jest.spyOn(reporter, 'sendSpans');
  spies.getFunctionSpan = jest.spyOn(awsSpan, 'getFunctionSpan');
  spies.getEndFunctionSpan = jest.spyOn(awsSpan, 'getEndFunctionSpan');
  spies.addRttToFunctionSpan = jest.spyOn(awsSpan, 'addRttToFunctionSpan');
  spies.SpansHive = {};
  spies.SpansHive.getSpans = jest.spyOn(globals.SpansHive, 'getSpans');
  spies.SpansHive.addSpan = jest.spyOn(globals.SpansHive, 'addSpan');
  spies.clearGlobals = jest.spyOn(globals, 'clearGlobals');

  beforeEach(() => {
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
    expect(result2).toEqual({});
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
    spies.SpansHive.getSpans.mockReturnValueOnce(spans);

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
  });

  test('asyncCallbackResolver', () => {
    const resolve = jest.fn();
    const err = 'err';
    const data = 'data';
    const type = tracer.ASYNC_CALLBACKED;
    tracer.asyncCallbackResolver(resolve)(err, data);
    expect(resolve).toHaveBeenCalledWith({ err, data, type });
  });

  test('nonAsyncCallbackResolver', () => {
    const resolve = jest.fn();
    const err = 'err';
    const data = 'data';
    const type = tracer.NON_ASYNC_CALLBACKED;
    tracer.nonAsyncCallbackResolver(resolve)(err, data);
    expect(resolve).toHaveBeenCalledWith({ err, data, type });
  });

  test('promisifyUserHandler', async () => {
    const userHandler = jest.fn();
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
  });
});
