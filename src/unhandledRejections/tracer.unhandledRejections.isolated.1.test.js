/* eslint-disable */
import { AxiosMocker } from '../../testUtils/axiosMocker';
import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { sleep } from '../../testUtils/sleep';
import * as utils from '../utils';

const TOKEN = 't_10faa5e13e7844aaa1234';

describe('tracer unhandledRejections with no original handler', () => {
  const spies = {};
  spies.setSwitchOff = jest.spyOn(utils, 'setSwitchOff');
  spies.setVerboseMode = jest.spyOn(utils, 'setVerboseMode');

  beforeEach(() => {
    Object.keys(spies).map((x) => spies[x].mockClear());
  });

  test('trace => UnhandledPromiseRejection with no original handler', async () => {
    process.exit = jest.fn();

    const mError = new Error('dead lock');
    jest.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (event === 'unhandledRejection') {
        handler(mError);
      }
    });

    const { context } = new HandlerInputsBuilder().build();

    const tracer = require('../tracer/tracer');
    spies.trace = jest.spyOn(tracer, 'trace');
    const lumigoImport = require('../index');
    const lumigo = lumigoImport({ token: TOKEN });

    const userHandler = async (event, context) => {
      await sleep(0);
    };
    await lumigo.trace(userHandler)({}, context);
    await process._events.unhandledRejection('Boom', Promise.reject('Boom'));

    const lastSpan = AxiosMocker.getSentSpans().pop().pop();
    expect(lastSpan.error.type).toBe('Runtime.UnhandledPromiseRejection');
    expect(lastSpan.error.message).toBe('Boom');
  });
});
