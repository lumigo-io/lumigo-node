const utils = require('./utils');

jest.mock('../package.json', () => ({
  name: '@lumigo/tracerMock',
  version: '1.2.3',
}));

describe('utils', () => {
  test('getContextInfo', () => {
    const awsRequestId = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';
    const functionName = 'w00t';
    const remainingTimeInMillis = 123456;
    const getRemainingTimeInMillis = jest.fn(() => remainingTimeInMillis);
    const context = {
      awsRequestId,
      functionName,
      getRemainingTimeInMillis,
    };

    expect(utils.getContextInfo(context)).toEqual({
      functionName,
      awsRequestId,
      remainingTimeInMillis,
    });
  });

  test('getTracerInfo', () => {
    expect(utils.getTracerInfo()).toEqual({
      name: '@lumigo/tracerMock',
      version: '1.2.3',
    });
  });

  test('getTraceId', () => {
    const awsXAmznTraceId =
      'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';
    const expected = {
      Parent: '59fa1aeb03c2ec1f',
      Root: '1-5b1d2450-6ac46730d346cad0e53f89d0',
      Sampled: '1',
    };
    expect(utils.getTraceId(awsXAmznTraceId)).toEqual(expected);
    expect(() => utils.getTraceId('x;y')).toThrowErrorMatchingSnapshot();
    expect(() =>
      utils.getTraceId('a=b;c=d;e=f')
    ).toThrowErrorMatchingSnapshot();
  });

  test('isAsyncFn', () => {
    const asyncFn = async x => x;
    expect(utils.isAsyncFn(asyncFn)).toBe(true);
    const notAsyncFn = x => x;
    expect(utils.isAsyncFn(notAsyncFn)).toBe(false);
  });

  test('getAWSEnvironment', () => {
    const oldEnv = Object.assign({}, process.env);
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

    const expected = {
      awsExecutionEnv: 'AWS_Lambda_nodejs8.10',
      awsLambdaFunctionMemorySize: '1024',
      awsLambdaFunctionName: 'aws-nodejs-dev-hello',
      awsLambdaFunctionVersion: '$LATEST',
      awsLambdaLogGroupName: '/aws/lambda/aws-nodejs-dev-hello',
      awsLambdaLogStreamName:
        '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
      awsLambdaRuntimeDir: '/var/runtime',
      awsLambdaTaskRoot: '/var/task',
      awsRegion: 'us-east-1',
      awsXAmznTraceId:
        'Root=1-5cdcf03a-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0',
    };
    expect(utils.getAWSEnvironment()).toEqual(expected);
    process.env = { ...oldEnv };
  });

  test('isWarm', () => {
    expect(utils.isWarm()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_IS_WARM: 'TRUE' };
    expect(utils.isWarm()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isVerboseMode', () => {
    expect(utils.isVerboseMode()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_VERBOSE: 'TRUE' };
    expect(utils.isVerboseMode()).toBe(true);
    process.env = { ...oldEnv };
  });
});
