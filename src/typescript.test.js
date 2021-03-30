/* eslint-disable */
const exmapleEvent = require('../testUtils/testdata/events/alb-lambda-target-request-headers-only');
const node10xEnv = require('../testUtils/testdata/env/node10x');
import { handler as es2016handler } from '../testUtils/testdata/functions/typescript/ES2016';
import { handler as es2015handler } from '../testUtils/testdata/functions/typescript/ES2015';
import * as reporter from './reporter';

describe('Typescript versions tests', () => {
  jest.spyOn(global.console, 'log');
  global.console.log.mockImplementation(() => {});
  const spies = {};
  spies.trace = jest.spyOn(reporter, 'sendSpans');
  const oldEnv = Object.assign({}, process.env);

  const initAwsEnv = () => {
    process.env = { ...oldEnv, ...node10xEnv };
  };

  const lambdaContext = {
    getRemainingTimeInMillis: () => 30000,
  };

  const createTracer = () => {
    const token = 'DEADBEEF';
    const edgeHost = 'zarathustra.com';
    const tracer = require('./index')({ token, edgeHost });
    return { tracer, token, edgeHost };
  };

  beforeEach(() => {
    process.env = { ...oldEnv };
    Object.keys(spies).map(x => spies[x].mockClear());
    reporter.sendSpans.mockImplementation(() => ({
      rtt: 1,
    }));
  });

  test('Compatible test for: TS -> ES 2016', async () => {
    initAwsEnv();
    const { tracer } = createTracer();
    const handler = tracer.trace(es2016handler);
    //Check that Async callback was invoked, if not the test will timed out
    await handler(exmapleEvent, lambdaContext);
  });

  test('Compatible test for: TS -> ES 2015', async () => {
    initAwsEnv();
    const { tracer } = createTracer();
    const handler = tracer.trace(es2015handler);
    //Check that Async callback was invoked, if not the test will timed out
    await handler(exmapleEvent, lambdaContext);
  });
});
