/* eslint-disable */
import each from 'jest-each';
import * as tracer from './tracer';
import * as utils from './utils';
import * as globals from './globals';
import * as reporter from './reporter';
import * as awsSpan from './spans/awsSpan';
import * as http from './hooks/http';
import httpHook from './hooks/http';
import * as logger from './logger';
import { TracerGlobals } from './globals';
import { setSwitchOff, STEP_FUNCTION_UID_KEY } from './utils';
import { LUMIGO_EVENT_KEY } from './utils';
import { HandlerInputesBuilder } from '../testUtils/handlerInputesBuilder';
import { EnvironmentBuilder } from '../testUtils/environmentBuilder';
import { SpansContainer } from './globals';
import { AxiosMocker } from '../testUtils/axiosMocker';
import { createContext } from '../testUtils/awsTestUtils';

const TOKEN = 't_10faa5e13e7844aaa1234';

jest.mock('./hooks/http');
describe('tracer', () => {
  const spies = {};
  spies.isSwitchedOff = jest.spyOn(utils, 'isSwitchedOff');
  spies.setSwitchOff = jest.spyOn(utils, 'setSwitchOff');
  spies.isAwsEnvironment = jest.spyOn(utils, 'isAwsEnvironment');
  spies.isSendOnlyIfErrors = jest.spyOn(utils, 'isSendOnlyIfErrors');
  spies.getContextInfo = jest.spyOn(utils, 'getContextInfo');
  spies.getRandomId = jest.spyOn(utils, 'getRandomId');
  spies.addStepFunctionEvent = jest.spyOn(http, 'addStepFunctionEvent');
  spies.sendSingleSpan = jest.spyOn(reporter, 'sendSingleSpan');
  spies.sendSpans = jest.spyOn(reporter, 'sendSpans');
  spies.getFunctionSpan = jest.spyOn(awsSpan, 'getFunctionSpan');
  spies.getEndFunctionSpan = jest.spyOn(awsSpan, 'getEndFunctionSpan');
  spies.addRttToFunctionSpan = jest.spyOn(awsSpan, 'addRttToFunctionSpan');
  spies.getCurrentTransactionId = jest.spyOn(awsSpan, 'getCurrentTransactionId');
  spies.SpansContainer = {};
  spies.SpansContainer.getSpans = jest.spyOn(globals.SpansContainer, 'getSpans');
  spies.SpansContainer.clearSpans = jest.spyOn(globals.SpansContainer, 'clearSpans');
  spies.SpansContainer.addSpan = jest.spyOn(globals.SpansContainer, 'addSpan');
  spies.clearGlobals = jest.spyOn(globals, 'clearGlobals');
  spies.warnClient = jest.spyOn(logger, 'warnClient');
  spies.logWarn = jest.spyOn(logger, 'warn');
  spies.log = jest.spyOn(console, 'log');
  spies.log.mockImplementation(() => {});

  beforeEach(() => {
    httpHook.mockClear();
    jest.clearAllMocks();
  });
  test('startTrace - not failed on error', async () => {
    //TODO: Rewrite this test without mocks
    const err1 = new Error('stam1');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err1;
    });

    await expect(tracer.startTrace()).resolves.toEqual(null);
  });

  test('startTrace - simple flow', async () => {
    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    await tracer.startTrace();

    const requests = AxiosMocker.getRequests();
    expect(requests.length).toEqual(1);
  });

  test('startTrace - not sending start-span on non-aws env', async () => {
    new EnvironmentBuilder().notAwsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    await tracer.startTrace();

    const requests = AxiosMocker.getRequests();
    expect(requests.length).toEqual(0);
  });

  test('startTrace - not sending start-span on SEND_ONLY_ON_ERROR', async () => {
    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    utils.setSendOnlyIfErrors();

    await tracer.startTrace();

    const requests = AxiosMocker.getRequests();
    expect(requests.length).toEqual(0);
  });

  test('startTrace - timeout timer - simple flow', async done => {
    const timeout = 2000;
    const testBuffer = 50;

    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().withTimeout(timeout).build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    await tracer.startTrace();
    SpansContainer.addSpan({ id: 'SomeRandomHttpSpan' });

    setTimeout(() => {
      const requests = AxiosMocker.getRequests();
      //1 for start span, 1 for SomeRandomHttpSpan
      expect(requests.length).toEqual(2);
      done();
    }, timeout + testBuffer);
  });

  test('startTrace - timeout timer - too short timeout', async done => {
    const timeout = 500;
    const testBuffer = 50;

    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().withTimeout(timeout).build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    await tracer.startTrace();
    SpansContainer.addSpan({ id: 'SomeRandomHttpSpan' });

    setTimeout(() => {
      const requests = AxiosMocker.getRequests();
      //1 for start span
      expect(requests.length).toEqual(1);
      done();
    }, timeout + testBuffer);
  });

  test('startTrace - timeout timer - called twice', async done => {
    const timeout = 2000;
    const testBuffer = 50;

    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().withTimeout(timeout).build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    await tracer.startTrace();
    await tracer.startTrace();
    SpansContainer.addSpan({ id: 'SomeRandomHttpSpan' });

    setTimeout(() => {
      const requests = AxiosMocker.getRequests();
      //Expect 3 - 2 start spans and 1 from the timer
      expect(requests.length).toEqual(3);
      done();
    }, timeout + testBuffer);
  });

  test('startTrace - timeout timer - too short timeout (timer not effects)', async done => {
    const timeout = 10;
    const testBuffer = 50;

    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().withTimeout(timeout).build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    await tracer.startTrace();
    SpansContainer.addSpan({ id: 'SomeRandomHttpSpan' });

    setTimeout(() => {
      const requests = AxiosMocker.getRequests();
      //Expect 1 for start span
      expect(requests.length).toEqual(1);
      done();
    }, timeout + testBuffer);
  });

  test('startTrace - timeout timer - SEND_ONLY_ON_ERROR - not sending spans', async done => {
    const timeout = 1000;
    const testBuffer = 50;

    utils.setSendOnlyIfErrors();
    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().withTimeout(timeout).build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    await tracer.startTrace();
    SpansContainer.addSpan({ id: 'SomeRandomHttpSpan' });

    setTimeout(() => {
      const requests = AxiosMocker.getRequests();
      expect(requests.length).toEqual(0);
      done();
    }, timeout + testBuffer);
  });

  test('isCallbacked', async () => {
    expect(tracer.isCallbacked({ type: tracer.HANDLER_CALLBACKED })).toBe(true);
    expect(tracer.isCallbacked({ type: tracer.HANDLER_CALLBACKED })).toBe(true);
    expect(tracer.isCallbacked({ type: tracer.ASYNC_HANDLER_RESOLVED })).toBe(false);
  });

  test('endTrace; callbackWaitsForEmptyEventLoop is false', async () => {
    spies.isSwitchedOff.mockReturnValueOnce(false);
    spies.isAwsEnvironment.mockReturnValueOnce(true);

    const rtt = 1234;
    spies.sendSpans.mockImplementationOnce(() => {});
    spies.getCurrentTransactionId.mockReturnValueOnce('x');

    const dummySpan = { x: 'y', transactionId: 'x' };
    const functionSpan = { a: 'b', c: 'd', transactionId: 'x' };
    const handlerReturnValue = 'Satoshi was here1';
    const endFunctionSpan = { a: 'b', c: 'd', rtt, transactionId: 'x' };

    spies.getContextInfo.mockReturnValueOnce({
      callbackWaitsForEmptyEventLoop: false,
    });

    spies.SpansContainer.getSpans.mockReturnValueOnce([dummySpan]);
    spies.getEndFunctionSpan.mockReturnValueOnce(endFunctionSpan);

    const result1 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result1).toEqual(undefined);

    expect(spies.isSwitchedOff).toHaveBeenCalled();
    expect(spies.isAwsEnvironment).toHaveBeenCalled();
    expect(spies.getEndFunctionSpan).toHaveBeenCalledWith(functionSpan, handlerReturnValue);
    expect(spies.sendSpans).toHaveBeenCalledWith([dummySpan, endFunctionSpan]);
    expect(spies.clearGlobals).toHaveBeenCalled();

    spies.isAwsEnvironment.mockReturnValueOnce(false);
    spies.isSwitchedOff.mockReturnValueOnce(false);

    const result2 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result2).toEqual(undefined);
    expect();

    spies.clearGlobals.mockClear();

    spies.logWarn.mockImplementationOnce(() => {});
    const err2 = new Error('stam2');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err2;
    });

    await tracer.endTrace(functionSpan, handlerReturnValue);

    expect(spies.logWarn).toHaveBeenCalledWith('endTrace failure', err2);
    expect(spies.clearGlobals).toHaveBeenCalled();
  });

  test('endTrace; callbackWaitsForEmptyEventLoop is true', async () => {
    spies.isSwitchedOff.mockReturnValueOnce(false);
    spies.isAwsEnvironment.mockReturnValueOnce(true);

    const functionSpan = { a: 'b', c: 'd' };
    const handlerReturnValue = { type: tracer.HANDLER_CALLBACKED };

    spies.getContextInfo.mockReturnValueOnce({
      callbackWaitsForEmptyEventLoop: true,
    });

    const result1 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result1).toEqual(undefined);

    expect(spies.isSwitchedOff).toHaveBeenCalled();
    expect(spies.isAwsEnvironment).toHaveBeenCalled();

    spies.isAwsEnvironment.mockReturnValueOnce(false);
    spies.isSwitchedOff.mockReturnValueOnce(false);

    const result2 = await tracer.endTrace(functionSpan, handlerReturnValue);
    expect(result2).toEqual(undefined);

    spies.clearGlobals.mockClear();

    spies.logWarn.mockImplementationOnce(() => {});
    const err2 = new Error('stam2');
    spies.isSwitchedOff.mockImplementationOnce(() => {
      throw err2;
    });

    await tracer.endTrace(functionSpan, handlerReturnValue);

    expect(spies.logWarn).toHaveBeenCalledWith('endTrace failure', err2);
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

  test('promisifyUserHandler async ', async () => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const data = 'Satoshi was here';
    const err = new Error('w00t');
    const userHandler1 = async () => Promise.resolve(data);
    expect(tracer.promisifyUserHandler(userHandler1, event, context)).resolves.toEqual({
      err: null,
      data,
      type: tracer.ASYNC_HANDLER_RESOLVED,
    });

    const userHandler2 = async () => Promise.reject(err);
    expect(tracer.promisifyUserHandler(userHandler2, event, context)).resolves.toEqual({
      err,
      data: null,
      type: tracer.ASYNC_HANDLER_REJECTED,
    });

    const userHandler3 = async (event, context, callback) => {
      const err = null;
      const data = 'async callbacked?';
      callback(err, data);
    };
    expect(tracer.promisifyUserHandler(userHandler3, event, context)).resolves.toEqual({
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
    expect(tracer.promisifyUserHandler(userHandler1, event, context)).resolves.toEqual({
      err,
      data: null,
      type: tracer.NON_ASYNC_HANDLER_ERRORED,
    });

    const userHandler2 = (event, context, callback) => {
      const err = null;
      const data = 'non async callbacked?';
      callback(err, data);
    };
    await expect(tracer.promisifyUserHandler(userHandler2, event, context)).resolves.toEqual({
      err: null,
      data: 'non async callbacked?',
      type: tracer.HANDLER_CALLBACKED,
    });
  });
  each([['t_'], [''], ['10faa5e13e7844aaa1234']]).test('trace; invalid token [%s]', token => {
    require('./index')({ token });
    expect(spies.warnClient).toBeCalledWith(
      'Invalid Token. Go to Lumigo Settings to get a valid token.'
    );
    expect(spies.warnClient).toHaveBeenCalledTimes(1);
    expect(spies.isSwitchedOff).toHaveBeenCalled();
  });

  test('trace; no context', async () => {
    const token = TOKEN;
    const lumigoTracer = require('./index')({ token });

    const userHandler1 = async event => {
      return 'ok';
    };
    const event = { a: 'b', c: 'd' };

    await lumigoTracer.trace(userHandler1)(event);

    expect(spies.warnClient).toHaveBeenCalledTimes(1);
  });

  test('trace; non async callbacked', async done => {
    const token = TOKEN;
    const lumigoTracer = require('./index')({ token });

    const retVal = 'The Tracer Wars';
    const userHandler1 = (event, context, callback) => callback(null, retVal);
    const callback1 = (err, data) => {
      expect(data).toEqual(retVal);
      done();
    };

    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    await lumigoTracer.trace(userHandler1)(event, context, callback1);

    expect(httpHook).toHaveBeenCalledTimes(1);
  });

  test('trace; imported twice', async done => {
    const token = TOKEN;
    const lumigoTracer1 = require('./index')({ token });
    const lumigoTracer2 = require('./index')({ token });

    const retVal = 'The Tracer Wars';
    const userHandler1 = (event, context, callback) => callback(null, retVal);
    const callback1 = (err, data) => {
      expect(data).toEqual(retVal);
      done();
    };

    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    await lumigoTracer1.trace(userHandler1)(event, context, callback1);
    await lumigoTracer2.trace(userHandler1)(event, context, callback1);

    expect(httpHook).toHaveBeenCalledTimes(1);
  });

  test('trace; non async throw error', async () => {
    const token = TOKEN;
    const lumigoTracer = require('./index')({ token });

    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    const userHandler2 = (event, context, callback) => {
      throw new Error('bla');
    };
    const callback2 = jest.fn();
    await expect(lumigoTracer.trace(userHandler2)(event, context, callback2)).rejects.toEqual(
      new Error('bla')
    );

    expect(httpHook).toHaveBeenCalledTimes(1);
  });

  test('trace; async callbacked ', async done => {
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };
    const token = TOKEN;

    const retVal = 'The Tracer Wars';
    const callback3 = (err, data) => {
      expect(data).toEqual(retVal);
      done();
    };

    spies.isSwitchedOff.mockReturnValueOnce(true);

    const userHandler3 = async (event, context, callback) => {
      callback(null, retVal);
    };
    await tracer.trace({ token })(userHandler3)(event, context, callback3);
  });

  test('trace; async resolved ', async () => {
    const token = TOKEN;
    const lumigoTracer = require('./index')({ token });
    expect(spies.warnClient).toHaveBeenCalledTimes(0);
    expect(spies.setSwitchOff).not.toHaveBeenCalled();
    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    const retVal = 'The Tracer Wars';
    const callback4 = jest.fn();

    const userHandler4 = async (event, context, callback) => {
      return retVal;
    };
    await expect(lumigoTracer.trace(userHandler4)(event, context, callback4)).resolves.toEqual(
      retVal
    );

    expect(httpHook).toHaveBeenCalledTimes(1);
  });

  test('trace; async rejected', async () => {
    const token = TOKEN;
    const lumigoTracer = require('./index')({ token });

    const event = { a: 'b', c: 'd' };
    const context = { e: 'f', g: 'h' };

    const retVal = 'The Tracer Wars';
    const callback5 = jest.fn();

    const userHandler5 = async (event, context, callback) => {
      throw new Error(retVal);
    };
    await expect(lumigoTracer.trace(userHandler5)(event, context, callback5)).rejects.toEqual(
      new Error(retVal)
    );

    expect(httpHook).toHaveBeenCalledTimes(1);
  });

  test('trace; follow AWS stringify on the return value - happy flow', async () => {
    // According to node's runtime: var/runtime/RAPIDClient.js:134, AWS stringify the message.
    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    const lumigoTracer = require('./index')({
      token: TOKEN,
    });

    const userHandler = async () => {
      // define object with specialized toJSON (like ddb items)
      return { a: 'b', toJSON: () => 'json magic' };
    };

    await lumigoTracer.trace(userHandler)({}, createContext(), jest.fn());

    const spans = AxiosMocker.getSentSpans();
    expect(spans[1][0].return_value).toEqual('"json magic"');
  });

  test('trace; follow AWS stringify on the return value - bad flow', async () => {
    // According to node's runtime: var/runtime/RAPIDClient.js:134, AWS raise exception if JSON.stringify fails.
    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    const lumigoTracer = require('./index')({
      token: TOKEN,
    });

    const userHandler = async () => {
      return {
        toJSON: () => {
          throw Error('FAIL');
        },
        toString: () => 'str',
      };
    };

    await lumigoTracer.trace(userHandler)({}, createContext(), jest.fn());

    const spans = AxiosMocker.getSentSpans();
    expect(spans[1][0].return_value).toEqual('str');
    expect(spans[1][0].error.message).toEqual(
      'Could not JSON.stringify the return value. This will probably fail the lambda. Original error: FAIL'
    );
  });

  test('trace; callback -> user raise error of type string', async () => {
    new EnvironmentBuilder().awsEnvironment().applyEnv();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    const lumigoTracer = require('./index')({
      token: TOKEN,
    });

    const userHandler = (event, context, callback) => {
      callback('ERROR');
    };

    await lumigoTracer.trace(userHandler)({}, createContext(), jest.fn());

    const spans = AxiosMocker.getSentSpans();
    expect(spans[1][0].error.type).toEqual('Error');
    expect(spans[1][0].error.message).toEqual('ERROR');
    expect(spans[1][0].error.stacktrace.length).toBeGreaterThan(0);
  });

  test('sendEndTraceSpans; dont clear globals in case of a leak', async () => {
    spies.sendSpans.mockImplementationOnce(() => {});
    spies.getEndFunctionSpan.mockReturnValueOnce({
      x: 'y',
      id: '1',
      transactionId: '123',
    });
    spies.getCurrentTransactionId.mockReturnValueOnce('123');

    TracerGlobals.setHandlerInputs({ event: { a: 1 } });
    spies.SpansContainer.getSpans.mockReturnValueOnce([
      { transactionId: '123', id: '1' },
      { transactionId: '123', id: '2' },
    ]);
    await tracer.sendEndTraceSpans({ id: '1_started' }, { err: null, data: null });
    expect(spies.warnClient).not.toHaveBeenCalled();
    expect(TracerGlobals.getHandlerInputs().event).toEqual({});

    TracerGlobals.setHandlerInputs({ event: { a: 1 } });
    spies.SpansContainer.getSpans.mockReturnValueOnce([
      { transactionId: '123', id: '1', reporterAwsRequestId: '2', parentId: '2' },
      { transactionId: '456', id: '2' },
    ]);
    await tracer.sendEndTraceSpans({ id: '1_started' }, { err: null, data: null });
    expect(spies.warnClient).not.toHaveBeenCalled();
    expect(TracerGlobals.getHandlerInputs().event).toEqual({});

    TracerGlobals.setHandlerInputs({ event: { a: 1 } });
    spies.SpansContainer.getSpans.mockReturnValueOnce([
      { transactionId: '123', id: '1', reporterAwsRequestId: '2' },
      { transactionId: '456', id: '2' },
    ]);
    expect(TracerGlobals.getHandlerInputs().event).toEqual({ a: 1 });
    await tracer.sendEndTraceSpans({ id: '1_started' }, { err: null, data: null });
    expect(spies.warnClient).toHaveBeenCalled();
  });

  test('can not wrap twice', async () => {
    const token = TOKEN;
    const lumigoTracer = require('./index')({ token });

    const event = { a: 'b', c: 'd' };

    const userHandlerAsync = async (event, context, callback) => 1;
    const result = lumigoTracer.trace(lumigoTracer.trace(userHandlerAsync))(event, {});
    await expect(result).resolves.toEqual(1);
    expect(httpHook).toHaveBeenCalledTimes(1);

    let callBackCalled = false;
    const callback = (err, val) => {
      expect(val).toEqual(2);
      callBackCalled = true;
    };
    const userHandlerSync = (event, context, callback) => {
      setTimeout(() => {
        callback(null, 2);
      }, 0);
      return 1; // we should ignore this!
    };
    const result2 = tracer.trace({ token })(tracer.trace({ token })(userHandlerSync))(
      event,
      {},
      callback
    );
    await expect(result2).resolves.toEqual(undefined);
    expect(callBackCalled).toEqual(true);
  });

  test('No exception at startHooks', async done => {
    httpHook.mockImplementationOnce(() => {
      throw new Error('Mocked error');
    });
    const handler = jest.fn(() => done());
    await tracer.trace({})(handler)({}, {});

    // No exception.
    expect(handler).toHaveBeenCalledOnce();
  });

  test('No exception at initialization', async done => {
    const mockedTracerGlobals = jest.spyOn(TracerGlobals, 'setHandlerInputs');
    mockedTracerGlobals.mockImplementationOnce(() => {
      throw new Error('Mocked error');
    });
    const handler = jest.fn(() => done());

    await tracer.trace({})(handler)({}, {});

    // No exception.
    expect(handler).toHaveBeenCalledOnce();
    mockedTracerGlobals.mockClear();
  });

  test('performStepFunctionLogic - performStepFunctionLogic doesnt call if not step function', async () => {
    const handler = jest.fn(async () => {});

    await tracer.trace({ stepFunction: false })(handler)({}, {});

    expect(spies.addStepFunctionEvent).not.toBeCalled();
  });

  test('performStepFunctionLogic - Happy flow', async () => {
    const handler = jest.fn(async () => ({ hello: 'world' }));
    spies.getRandomId.mockReturnValueOnce('123');

    const result = await tracer.trace({ stepFunction: true })(handler)({}, {});

    expect(result).toEqual({
      hello: 'world',
      [LUMIGO_EVENT_KEY]: { [STEP_FUNCTION_UID_KEY]: '123' },
    });
    expect(spies.addStepFunctionEvent).toBeCalledWith('123');
    spies.addStepFunctionEvent.mockClear();
  });

  test('performStepFunctionLogic - Error should be contained', async () => {
    const handler = jest.fn(async () => ({ hello: 'world' }));
    spies.getRandomId.mockReturnValueOnce('123');
    spies.addStepFunctionEvent.mockImplementationOnce(() => {
      throw new Error('stam1');
    });

    const result3 = await tracer.trace({ stepFunction: true })(handler)({}, {});

    expect(result3).toEqual({ hello: 'world' });
    expect(spies.addStepFunctionEvent).toBeCalled();
    spies.addStepFunctionEvent.mockClear();
  });

  test('performStepFunctionLogic - override the step function key if exists', async () => {
    const handler = jest.fn(async () => ({
      hello: 'world',
      [LUMIGO_EVENT_KEY]: { [STEP_FUNCTION_UID_KEY]: 'old' },
    }));
    const handlerInputs = new HandlerInputesBuilder().build();

    const result = await tracer.trace({ stepFunction: true })(handler)(
      handlerInputs.event,
      handlerInputs.context
    );

    expect(result[LUMIGO_EVENT_KEY][STEP_FUNCTION_UID_KEY]).not.toEqual('old');
    const requests = AxiosMocker.getRequests();
    expect(requests.length).toEqual(2);
  });
});
