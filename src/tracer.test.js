import * as tracer from './tracer';
import * as utils from './utils';
import * as globals from './globals';
import * as reporter from './reporter';
import * as awsSpan from './spans/awsSpan';

describe('tracer', () => {
  const spies = {};
  spies.isSwitchedOff = jest.spyOn(utils, 'isSwitchedOff');
  spies.sendSingleSpan = jest.spyOn(reporter, 'sendSingleSpan');
  spies.getFunctionSpan = jest.spyOn(awsSpan, 'getFunctionSpan');
  spies.addRttToFunctionSpan = jest.spyOn(awsSpan, 'addRttToFunctionSpan');

  beforeEach(() => {
    Object.keys(spies).map(x => spies[x].mockClear());
  });

  test.only('startTrace', async () => {
    spies.isSwitchedOff.mockReturnValueOnce(false);

    const rtt = 1234;
    spies.sendSingleSpan.mockReturnValueOnce({ rtt });

    const functionSpan = { a: 'b', c: 'd' };
    spies.getFunctionSpan.mockReturnValueOnce(functionSpan);

    const retVal = 'Satoshi was here';
    spies.addRttToFunctionSpan.mockReturnValueOnce(retVal);
    await tracer.startTrace();

    expect(spies.isSwitchedOff).toHaveBeenCalled();
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
