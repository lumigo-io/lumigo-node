import * as reporter from './reporter';
import { TracerGlobals } from './globals';
import got from 'got';

jest.mock('got');

describe('reporter', () => {
  const spies = {};
  Object.keys(reporter).map(
    x => typeof spies[x] === 'function' && (spies[x] = jest.spyOn(reporter, x))
  );

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

  test('getEdgeHost', () => {
    TracerGlobals.setTracerInputs({ token: '', edgeHost: 'zarathustra.com' });
    expect(reporter.getEdgeHost()).toEqual('zarathustra.com');

    TracerGlobals.setTracerInputs({ token: '', edgeHost: '' });

    expect(reporter.getEdgeHost()).toEqual(
      'us-east-1.lumigo-tracer-edge.golumigo.com'
    );
  });

  test('getEdgeUrl', () => {
    const expectedEdgeUrl =
      'https://us-east-1.lumigo-tracer-edge.golumigo.com/api/spans';
    expect(reporter.getEdgeUrl()).toEqual(expectedEdgeUrl);
  });

  test('sendSingleSpan', () => {
    const retVal = { rtt: 1234 };
    console.log(spies);
    spies.sendSpans.mockReturnValueOnce(retVal);

    const span = { a: 'b', c: 'd' };
    const result = reporter.sendSingleSpan(span);

    expect(result).toEqual(retVal);
  });

  test.skip('sendSpans', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });

    const span = { a: 'b', c: 'd' };

    const expectedHeaders = {
      'Content-Type': 'application/json',
      Authorization: token,
    };
    const expectedEdgeUrl =
      'https://us-east-1.lumigo-tracer-edge.golumigo.com/api/spans';
    const expectedData = JSON.stringify([span]);

    axios.post.mockResolvedValue('All good in da hood.');
    const p = reporter.sendSingleSpan(span);
    expect(await p).toEqual('All good in da hood.');

    expect(axios.post).toHaveBeenCalledWith(expectedEdgeUrl, {
      headers: expectedHeaders,
      data: expectedData,
    });
  });
});
