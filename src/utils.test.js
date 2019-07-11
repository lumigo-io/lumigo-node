import * as utils from './utils';
import { TracerGlobals } from './globals';
import EventEmitter from 'events';
import https from 'https';
import crypto from 'crypto';

jest.mock('https');
jest.mock('../package.json', () => ({
  name: '@lumigo/tracerMock',
  version: '1.2.3',
}));

describe('utils', () => {
  const spies = {};
  spies.randomBytes = jest.spyOn(crypto, 'randomBytes');

  test('getContextInfo', () => {
    const awsRequestId = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';
    const functionName = 'w00t';
    const remainingTimeInMillis = 123456;
    const getRemainingTimeInMillis = jest.fn(() => remainingTimeInMillis);
    const awsAccountId = `985323015126`;
    const invokedFunctionArn = `arn:aws:lambda:us-east-1:${awsAccountId}:function:aws-nodejs-dev-hello`;

    const context = {
      awsRequestId,
      functionName,
      invokedFunctionArn,
      getRemainingTimeInMillis,
    };

    expect(utils.getContextInfo(context)).toEqual({
      functionName,
      awsRequestId,
      awsAccountId,
      remainingTimeInMillis,
    });

    const context2 = {
      awsRequestId,
      functionName,
      invokedFunctionArn: '',
      getRemainingTimeInMillis,
    };
    expect(utils.getContextInfo(context2)).toEqual({
      functionName,
      awsRequestId,
      awsAccountId: '',
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
      transactionId: '6ac46730d346cad0e53f89d0',
    };
    expect(utils.getTraceId(awsXAmznTraceId)).toEqual(expected);

    expect(() => utils.getTraceId(null)).toThrow(
      'Missing _X_AMZN_TRACE_ID in Lambda Env Vars.'
    );

    expect(() => utils.getTraceId('x;y')).toThrow(
      'Expected 3 semi-colon separated parts in _X_AMZN_TRACE_ID.'
    );

    expect(() => utils.getTraceId('a=b;c=d;e=f')).toThrow(
      "Either Root, Parent or Sampled weren't found in traceId."
    );
  });

  test('getPatchedTraceId', () => {
    spies.randomBytes.mockReturnValueOnce(Buffer.from('aa'));
    const awsXAmznTraceId =
      'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';
    const expected =
      'Root=1-00006161-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';
    expect(utils.getPatchedTraceId(awsXAmznTraceId)).toEqual(expected);
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

  test('isAwsEnvironment', () => {
    expect(utils.isAwsEnvironment()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LAMBDA_RUNTIME_DIR: 'BLA BLA' };
    expect(utils.isAwsEnvironment()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isVerboseMode', () => {
    expect(utils.isVerboseMode()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_VERBOSE: 'TRUE' };
    expect(utils.isVerboseMode()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isWarm', () => {
    expect(utils.isWarm()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_IS_WARM: 'TRUE' };
    expect(utils.isWarm()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isDebug', () => {
    expect(utils.isDebug()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_DEBUG: 'TRUE' };
    expect(utils.isDebug()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isSwitchedOff', () => {
    expect(utils.isSwitchedOff()).toBe(false);

    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_SWITCH_OFF: 'TRUE' };
    expect(utils.isSwitchedOff()).toBe(true);

    process.env = { ...oldEnv };
    expect(utils.isSwitchedOff()).toBe(false);

    TracerGlobals.setTracerInputs({ token: '', edgeHost: '', switchOff: true });
    expect(utils.isSwitchedOff()).toBe(true);
    TracerGlobals.setTracerInputs({
      token: '',
      edgeHost: '',
      switchOff: false,
    });
  });

  test('setWarm', () => {
    expect(utils.isWarm()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setWarm();
    expect(utils.isWarm()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('setSwitchOff', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setSwitchOff();
    expect(utils.isSwitchedOff()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('setIsDebug', () => {
    expect(utils.isDebug()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setIsDebug();
    expect(utils.isDebug()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isString', () => {
    expect(utils.isString('asdf')).toBe(true);
    expect(utils.isString({ satoshi: 'nakamoto' })).toBe(false);
  });

  test('prune', () => {
    expect(utils.prune('abcdefg', 3)).toEqual('abc');
    expect(utils.prune('abcdefg')).toEqual('abcdefg');
  });

  test('stringifyAndPrune', () => {
    const obj = {
      founder: 'Elon Musk',
      companies: ['SpaceX', 'Tesla', 'Boring Company', 'PayPal', 'X.com'],
    };
    expect(utils.stringifyAndPrune(obj, 4)).toEqual('{"fo');
    expect(utils.stringifyAndPrune(obj)).toEqual(JSON.stringify(obj));
  });

  test('pruneData', () => {
    const obj = {
      founder: 'Elon Musk',
      companies: ['SpaceX', 'Tesla', 'Boring Company', 'PayPal', 'X.com'],
    };
    expect(utils.pruneData(obj, 4)).toEqual('{"fo');
    expect(utils.pruneData('abcdefg', 3)).toEqual('abc');
  });

  test('stringifyError', () => {
    const err = new Error('baba');
    const error = JSON.stringify(err, Object.getOwnPropertyNames(err));
    expect(utils.stringifyError(err)).toEqual(error);
  });

  test('lowerCaseObjectKeys', () => {
    const o = { X: 'y', z: 'C' };
    const expected = { x: 'y', z: 'C' };
    expect(utils.lowerCaseObjectKeys(o)).toEqual(expected);
  });

  test('getRandomString', () => {
    spies.randomBytes.mockReturnValueOnce(Buffer.from('lmno'));
    expect(utils.getRandomString(10)).toEqual('6c6d6e6f');
  });

  test('getRandomId', () => {
    spies.randomBytes.mockImplementation(nr => Buffer.from(`l`.repeat(nr)));
    expect(utils.getRandomId()).toEqual('6c6c6c6c-6c6c-6c6c-6c6c-6c6c6c6c6c6c');
  });

  test('isAwsService', () => {
    const s1 = 'dynamodb';
    const host1 = `${s1}.amazonaws.com`;
    expect(utils.isAwsService(host1)).toBe(true);

    const s2 = 'xyz';
    const host2 = `${s2}.cloud.google.com`;
    expect(utils.isAwsService(host2)).toBe(false);
  });

  test('httpReq', async () => {
    const options = { bla: 'bla' };
    const req = new EventEmitter();
    const reqBody = 'abcdefg';
    req.end = jest.fn();
    req.write = jest.fn();
    https.request.mockReturnValueOnce(req);

    const p1 = utils.httpReq(options, reqBody);
    req.emit('error', 'errmsg');
    await expect(p1).rejects.toEqual('errmsg');

    https.request.mockClear();
    https.request.mockReturnValueOnce(req);

    const p2 = utils.httpReq(options, reqBody);

    const reqCallback = https.request.mock.calls[0][1];
    const res = new EventEmitter();
    const statusCode = 200;
    res.statusCode = statusCode;
    reqCallback(res);
    const data = 'chunky';
    res.emit('data', data);
    res.emit('end');
    await expect(p2).resolves.toEqual({ statusCode, data });

    expect(https.request).toHaveBeenCalledWith(options, expect.any(Function));
  });
});
