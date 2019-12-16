/* eslint-disable */
import { TracerGlobals } from './globals';
import * as reporter from './reporter';
import * as utils from './utils';
import * as logger from './logger';
import { getJSONBase64Size } from './utils';

jest.mock('../package.json', () => ({
  name: '@lumigo/tracerMock',
  version: '1.2.3',
}));

describe('reporter', () => {
  jest.spyOn(global.console, 'log');
  global.console.log.mockImplementation(() => {});
  const spies = {};
  spies['sendSpans'] = jest.spyOn(reporter, 'sendSpans');
  spies['now'] = jest.spyOn(global.Date, 'now');
  spies['httpReq'] = jest.spyOn(utils, 'httpReq');
  spies['isDebug'] = jest.spyOn(logger, 'isDebug');
  spies['isSendOnlyIfErrors'] = jest.spyOn(utils, 'isSendOnlyIfErrors');

  const oldEnv = Object.assign({}, process.env);
  beforeEach(() => {
    const awsEnv = {
      LAMBDA_TASK_ROOT: '/var/task',
      LAMBDA_RUNTIME_DIR: '/var/runtime',
      AWS_REGION: 'us-east-1',
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_LAMBDA_LOG_GROUP_NAME: '/aws/lambda/aws-nodejs-dev-hello',
      AWS_LAMBDA_LOG_STREAM_NAME:
        '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
      AWS_LAMBDA_FUNCTION_NAME: 'aws-nodejs-dev-hello',
      AWS_LAMBDA_FUNCTION_MEMORY_SIZE: '1024',
      AWS_LAMBDA_FUNCTION_VERSION: '$LATEST',
      _AWS_XRAY_DAEMON_ADDRESS: '169.254.79.2',
      _AWS_XRAY_DAEMON_PORT: '2000',
      AWS_XRAY_DAEMON_ADDRESS: '169.254.79.2:2000',
      AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
      _X_AMZN_TRACE_ID:
        'Root=1-5cdcf03a-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0',
      AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs8.10',
    };

    process.env = { ...oldEnv, ...awsEnv };
  });
  afterEach(() => {
    process.env = { ...oldEnv };
  });

  test('sendSingleSpan', async () => {
    const retVal = { rtt: 1234 };
    spies.sendSpans.mockReturnValueOnce(retVal);

    const span = { a: 'b', c: 'd' };
    const result = await reporter.sendSingleSpan(span);

    expect(result).toEqual(retVal);
  });

  test('isSpansContainsErrors', async () => {
    const genReturnValue = statusCode => ({
      returnValue: {
        statusCode,
      },
    });
    const dummy = { dummy: 'dummy' };
    const error = { error: 'error' };
    const spansWithStatusCode = [dummy, genReturnValue(200), dummy];
    const spansWithErrorStatusCode = [dummy, genReturnValue(500), dummy];
    const spansWithError = [dummy, error, dummy];
    const spansWithoutError = [dummy, dummy];

    const assertSpans = (spans, result) =>
      expect(reporter.isSpansContainsErrors(spans)).toEqual(result);

    assertSpans(spansWithStatusCode, false);
    assertSpans(spansWithErrorStatusCode, true);
    assertSpans(spansWithError, true);
    assertSpans(spansWithoutError, false);
  });

  test('sendSpans', async () => {
    utils.setDebug();
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });

    const span1 = { a: 'b', c: 'd' };
    const span2 = { e: 'f', g: 'h' };
    const errorSpan = { a: 'a', b: 'b', error: 'error' };

    const pkgNameMock = '@lumigo/tracerMock';
    const pkgVersionMock = '1.2.3';

    const expectedHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `${pkgNameMock}$${pkgVersionMock}`,
      Authorization: token,
    };
    const expectedHost = 'us-east-1.lumigo-tracer-edge.golumigo.com';

    const expectedPath = '/api/spans';
    const expectedMethod = 'POST';
    const expectedReqBody = JSON.stringify([span1, span2]);

    spies.now.mockReturnValueOnce(0);
    spies.now.mockReturnValueOnce(1024);
    spies.httpReq.mockImplementationOnce(() => {});
    let result = await reporter.sendSpans([span1, span2]);

    expect(spies.httpReq).toHaveBeenCalledWith(
      {
        host: expectedHost,
        path: expectedPath,
        method: expectedMethod,
        headers: expectedHeaders,
      },
      expectedReqBody
    );
    expect(result.rtt).toEqual(1024);

    //Test - isSendOnlyIfErrors is on, and no error spans -> no spans sent
    spies.isSendOnlyIfErrors.mockReturnValueOnce(true);
    spies.httpReq.mockClear();

    result = await reporter.sendSpans([span1, span2]);
    expect(spies.httpReq).toHaveBeenCalledTimes(0);
    expect(result.rtt).toEqual(0);

    //Test - isSendOnlyIfErrors is on, sent spans with errors
    spies.isSendOnlyIfErrors.mockReturnValueOnce(true);
    spies.httpReq.mockClear();
    spies.now.mockReturnValueOnce(0);
    spies.now.mockReturnValueOnce(1024);
    spies.httpReq.mockImplementationOnce(() => {});

    result = await reporter.sendSpans([span1, span2, errorSpan]);
    expect(spies.httpReq).toHaveBeenCalledTimes(1);
    expect(spies.httpReq).toHaveBeenCalledWith(
      {
        host: expectedHost,
        path: expectedPath,
        method: expectedMethod,
        headers: expectedHeaders,
      },
      JSON.stringify([span1, span2, errorSpan])
    );
    expect(result.rtt).toEqual(1024);
  });

  test('forgeRequestBody', async () => {
    const oldEnv = Object.assign({}, process.env);

    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';
    let spans = [{ dummy }, { dummy }, { dummyEnd }];

    let expectedResult = [{ dummy }, { dummyEnd }];
    let expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );

    spans = [{ dummy }, { dummy, error }, { dummyEnd }];
    expectedResult = [{ dummy, error }, { dummyEnd }];
    expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );

    utils.setPruneTraceOff();

    expect(reporter.forgeRequestBody(spans)).toEqual(JSON.stringify(spans));

    expect(reporter.forgeRequestBody([])).toEqual(undefined);

    process.env = { ...oldEnv };
  });
});
