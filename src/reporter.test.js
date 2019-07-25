/* eslint-disable */
import { TracerGlobals } from './globals';
import * as reporter from './reporter';
import * as utils from './utils';
import { getJSONSize } from './utils';

jest.mock('../package.json', () => ({
  name: '@lumigo/tracerMock',
  version: '1.2.3',
}));

describe('reporter', () => {
  const spies = {};
  spies['sendSpans'] = jest.spyOn(reporter, 'sendSpans');
  spies['now'] = jest.spyOn(global.Date, 'now');
  spies['httpReq'] = jest.spyOn(utils, 'httpReq');
  spies['isDebug'] = jest.spyOn(utils, 'isDebug');

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

  test('sendSpans', async () => {
    utils.setDebug();
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });

    const span1 = { a: 'b', c: 'd' };
    const span2 = { e: 'f', g: 'h' };

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
    const result = await reporter.sendSpans([span1, span2]);

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
  });

  test('spliceSpan', async () => {
    const dummy1 = 'dummy1';
    const dummy2 = 'dummy2';
    const dummyStart = 'dummyStart';
    const dummyEnd = 'dummyEnd';

    let spans = [{ dummyStart }, { dummy1 }, { dummy2 }, { dummyEnd }];

    reporter.spliceSpan(spans);
    expect(spans).toEqual([{ dummyStart }, { dummy1 }, { dummyEnd }]);

    reporter.spliceSpan(spans);
    expect(spans).toEqual([{ dummyStart }, { dummyEnd }]);

    reporter.spliceSpan(spans);
    expect(spans).toEqual([{ dummyStart }]);

    reporter.spliceSpan(spans);
    expect(spans).toEqual([]);
  });

  test('forgeRequestBody', async () => {
    const oldEnv = Object.assign({}, process.env);

    const dummy = 'dummy';
    const dummyStart = 'dummyStart';
    const dummyEnd = 'dummyEnd';
    let spans = [{ dummyStart }, { dummy }, { dummyEnd }];
    const dummyStartSize = getJSONSize(spans.slice(0).splice(1, 2));

    expect(reporter.forgeRequestBody(spans)).toEqual(JSON.stringify(spans));

    utils.setTrimSize();

    expect(reporter.forgeRequestBody(spans, dummyStartSize)).toEqual(
      JSON.stringify([{ dummyStart }])
    );

    expect(reporter.forgeRequestBody([])).toEqual(undefined);

    process.env = { ...oldEnv };
  });
});
