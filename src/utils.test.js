import * as utils from './utils';
import {
  getJSONBase64Size,
  MAX_ENTITY_SIZE,
  omitKeys,
  parseErrorObject,
  parseQueryParams,
  shouldScrubDomain,
  keyToOmitRegexes,
  LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  LUMIGO_SECRET_MASKING_REGEX,
  safeExecute,
  recursiveGetKey,
} from './utils';
import { TracerGlobals } from './globals';
import EventEmitter from 'events';
import https from 'https';
import crypto from 'crypto';
import { isDebug } from './logger';
import { GET_KEY_DEPTH_ENV_KEY } from './utils';

jest.mock('https');
jest.mock('../package.json', () => ({
  name: '@lumigo/tracerMock',
  version: '1.2.3',
}));

describe('utils', () => {
  const spies = {};
  spies.randomBytes = jest.spyOn(crypto, 'randomBytes');

  beforeEach(() => {
    const oldEnv = Object.assign({}, process.env);
    const awsEnv = {
      AWS_REGION: 'us-east-1',
      AWS_DEFAULT_REGION: 'us-east-1',
    };
    process.env = { ...oldEnv, ...awsEnv };
  });

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

  test('isSendOnlyIfErrors', () => {
    expect(utils.isSendOnlyIfErrors()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, SEND_ONLY_IF_ERROR: 'TRUE' };
    expect(utils.isSendOnlyIfErrors()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isPruneTraceOff', () => {
    expect(utils.isPruneTraceOff()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, LUMIGO_PRUNE_TRACE_OFF: 'TRUE' };
    expect(utils.isPruneTraceOff()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('getEventEntitySize', () => {
    expect(utils.getEventEntitySize()).toBe(MAX_ENTITY_SIZE);
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, MAX_EVENT_ENTITY_SIZE: ' 2048' };
    expect(utils.getEventEntitySize()).toBe(2048);
    process.env = { ...oldEnv };
  });

  test('getEventEntitySize NaN', () => {
    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, MAX_EVENT_ENTITY_SIZE: 'A 2048' };
    expect(utils.getEventEntitySize()).toBe(MAX_ENTITY_SIZE);
    process.env = { ...oldEnv };
  });

  test('setWarm', () => {
    expect(utils.isWarm()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setWarm();
    expect(utils.isWarm()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('setSendOnlyIfErrors', () => {
    expect(utils.isSendOnlyIfErrors()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setSendOnlyIfErrors();
    expect(utils.isSendOnlyIfErrors()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('setPruneTraceOff', () => {
    expect(utils.isPruneTraceOff()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setPruneTraceOff();
    expect(utils.isPruneTraceOff()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('getInvokedAliasOrNullInvalidArn', () => {
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'bad-format',
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.clearHandlerInputs();
  });

  test('isSwitchedOffInvalidAlias', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:alias',
      },
    });
    process.env['LUMIGO_VALID_ALIASES'] = '["wrong"]';
    expect(utils.isSwitchedOff()).toBe(true);
    TracerGlobals.clearHandlerInputs();
    process.env = { ...oldEnv };
  });

  test('isSwitchedOffValidAlias', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:alias',
      },
    });
    process.env['LUMIGO_VALID_ALIASES'] = '["alias"]';
    expect(utils.isSwitchedOff()).toBe(false);
    TracerGlobals.clearHandlerInputs();
    process.env = { ...oldEnv };
  });

  test('getInvokedAliasOrNull', () => {
    expect(utils.getInvokedAliasOrNull()).toBe(null);
    const oldEnv = Object.assign({}, process.env);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:alias',
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual('alias');
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name',
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'bad-arn',
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        no: 'arn',
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.clearHandlerInputs();
    process.env = { ...oldEnv };
  });

  test('isValidAlias', () => {
    expect(utils.isValidAlias()).toEqual(true);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn:
          'arn:aws:lambda:region:account:function:name:currentAlias',
      },
    });
    process.env['LUMIGO_VALID_ALIASES'] = '[]';
    expect(utils.isValidAlias()).toEqual(true);
    process.env['LUMIGO_VALID_ALIASES'] = '["1", "2"]';
    expect(utils.isValidAlias()).toEqual(false);
    process.env['LUMIGO_VALID_ALIASES'] = '["1", "2", "currentAlias"]';
    expect(utils.isValidAlias()).toEqual(true);
    process.env['LUMIGO_VALID_ALIASES'] = undefined;
  });

  test('setSwitchOff', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setSwitchOff();
    TracerGlobals.setTracerInputs({});
    expect(utils.isSwitchedOff()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('setDebug', () => {
    expect(isDebug()).toBe(false);
    const oldEnv = Object.assign({}, process.env);
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    expect(isDebug()).toBe(true);
    process.env = { ...oldEnv };
  });

  test('isString', () => {
    expect(utils.isString('asdf')).toBe(true);
    expect(utils.isString({ satoshi: 'nakamoto' })).toBe(false);
  });

  test('prune', () => {
    expect(utils.prune('abcdefg', 3)).toEqual('abc');
    expect(utils.prune('abcdefg')).toEqual('abcdefg');
    expect(utils.prune(undefined)).toEqual('');
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

  test('parseErrorObject', () => {
    //Default error
    const err1 = new Error('baba');
    const result1 = parseErrorObject(err1);

    expect(result1.type).toEqual('Error');
    expect(result1.message).toEqual('baba');
    expect(result1.stacktrace.length).toBeGreaterThan(0);

    //Custom error
    const err2 = new EvalError('eval');
    const result2 = parseErrorObject(err2);

    expect(result2.type).toEqual('EvalError');
    expect(result2.message).toEqual('eval');
    expect(result2.stacktrace.length).toBeGreaterThan(0);

    //Handle missing fields
    const err3 = {};
    const result3 = parseErrorObject(err3);

    expect(result3.type).toEqual(undefined);
    expect(result3.message).toEqual(undefined);
    expect(result3.stacktrace).toEqual(undefined);

    //Handle undefined
    const err4 = undefined;
    const result4 = parseErrorObject(err4);

    expect(result4.type).toEqual(undefined);
    expect(result4.message).toEqual(undefined);
    expect(result4.stacktrace).toEqual(undefined);
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

    const host3 = 'api.rti.dev.toyota.com';
    const responseData = { headers: { 'x-amzn-requestid': '1234' } };
    expect(utils.isAwsService(host3, responseData)).toBe(true);

    const responseData2 = { headers: { 'x-amz-request-id': '1234' } };
    expect(utils.isAwsService(host3, responseData2)).toBe(true);
  });

  test('addHeaders', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 4, c: 5 };

    const returnedTarget = Object.assign({}, target, source);
    expect(utils.addHeaders(target, source)).toEqual(returnedTarget);
  });

  test('removeLumigoFromStacktrace', () => {
    const err = {
      stack:
        'Error: bla\n' +
        '    at c (/var/task/child.js:15:11)\n' +
        '    at b (/var/task/child.js:17:19)\n' +
        '    at a (/var/task/child.js:18:19)\n' +
        '    at childFn (/var/task/child.js:19:3)\n' +
        '    at r (/var/task/node_modules/@lumigo/tracer/dist/lumigo.js:1:11897)\n' +
        '    at new Promise (<anonymous>)\n' +
        '    at g (/var/task/node_modules/@lumigo/tracer/dist/lumigo.js:1:11852)\n' +
        '    at Runtime.handler (/var/task/node_modules/@lumigo/tracer/dist/lumigo.js:1:12385)\n' +
        '    at Runtime.handleOnce (/var/runtime/Runtime.js:63:25)\n' +
        '    at process._tickCallback (internal/process/next_tick.js:68:7)',
    };
    const data = 'abcd';
    const type = '1234';
    const handlerReturnValue = { err, data, type };

    const expectedErr = {
      stack:
        'Error: bla\n' +
        '    at c (/var/task/child.js:15:11)\n' +
        '    at b (/var/task/child.js:17:19)\n' +
        '    at a (/var/task/child.js:18:19)\n' +
        '    at childFn (/var/task/child.js:19:3)\n' +
        '    at Runtime.handleOnce (/var/runtime/Runtime.js:63:25)\n' +
        '    at process._tickCallback (internal/process/next_tick.js:68:7)',
    };

    const expectedHandlerReturnValue = { err: expectedErr, data, type };

    expect(utils.removeLumigoFromStacktrace(handlerReturnValue)).toEqual(
      expectedHandlerReturnValue
    );

    expect(
      utils.removeLumigoFromStacktrace({ err: null, data: 'y', type: 'x' })
    ).toEqual({ err: null, data: 'y', type: 'x' });
  });

  test('removeLumigoFromStacktrace no exception', () => {
    utils.removeLumigoFromStacktrace(null);
    // No exception.
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

  test('getEdgeHost', () => {
    TracerGlobals.setTracerInputs({ token: '', edgeHost: 'zarathustra.com' });
    expect(utils.getEdgeHost()).toEqual('zarathustra.com');

    TracerGlobals.setTracerInputs({ token: '', edgeHost: '' });

    expect(utils.getEdgeHost()).toEqual(
      'us-east-1.lumigo-tracer-edge.golumigo.com'
    );
  });

  test('spanHasErrors', () => {
    const regSpan = {
      account: '985323015126',
      ended: 1256,
      id: 'not-a-random-id',
      info: {
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        httpInfo: {
          host: 'your.mind.com',
          request: {
            body: '"the first rule of fight club"',
            headers: '{"Tyler":"Durden"}',
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {
            body: '"Well, Tony is dead."',
            headers: '{"Peter":"Parker"}',
            receivedTime: 1256,
            statusCode: 200,
          },
        },
        httpMethod: 'POST',
        token: 'DEADBEEF',
        transactionId: '64a1b06067c2100c52e51ef4',
        type: 'http',
        vendor: 'AWS',
        version: '$LATEST',
      },
    };

    const httpErrorSpan = {
      account: '985323015126',
      ended: 1256,
      id: 'not-a-random-id',
      info: {
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        httpInfo: {
          host: 'your.mind.com',
          request: {
            body: '"the first rule of fight club"',
            headers: '{"Tyler":"Durden"}',
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {
            body: '"Well, Tony is dead."',
            headers: '{"Peter":"Parker"}',
            receivedTime: 1256,
            statusCode: 500,
          },
        },
        httpMethod: 'POST',
        token: 'DEADBEEF',
        transactionId: '64a1b06067c2100c52e51ef4',
        type: 'http',
        vendor: 'AWS',
        version: '$LATEST',
      },
    };

    const errorSpan = {
      account: '985323015126',
      ended: 1256,
      id: 'not-a-random-id',
      error: true,
      info: {
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        httpInfo: {
          host: 'your.mind.com',
          request: {
            body: '"the first rule of fight club"',
            headers: '{"Tyler":"Durden"}',
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {
            body: '"Well, Tony is dead."',
            headers: '{"Peter":"Parker"}',
            receivedTime: 1256,
          },
        },

        httpMethod: 'POST',
        token: 'DEADBEEF',
        transactionId: '64a1b06067c2100c52e51ef4',
        type: 'http',
        vendor: 'AWS',
        version: '$LATEST',
      },
    };

    expect(utils.spanHasErrors(regSpan)).toEqual(false);
    expect(utils.spanHasErrors(httpErrorSpan)).toEqual(true);
    expect(utils.spanHasErrors(errorSpan)).toEqual(true);
  });

  test('getEdgeUrl', () => {
    const expected = {
      host: 'us-east-1.lumigo-tracer-edge.golumigo.com',
      path: '/api/spans',
    };
    expect(utils.getEdgeUrl()).toEqual(expected);
  });

  test('getJSONBase64Size', () => {
    expect(getJSONBase64Size({ foo: 'bar' })).toEqual(18);
  });

  test('parseQueryParams', () => {
    const queryParams = 'Action=Publish&TopicArn=SomeTopic&Version=2010-03-31';

    const action = parseQueryParams(queryParams)['Action'];
    const notFound = parseQueryParams(queryParams)['Actionsss'];

    expect(action).toEqual('Publish');
    expect(notFound).toEqual(undefined);
  });

  test('parseQueryParams -> no success flow', () => {
    const invalid = parseQueryParams('invalid-url')['Action'];
    const notFound = parseQueryParams(undefined)['Actionsss'];
    const weirdInput = parseQueryParams(2)['Actionsss'];

    expect(invalid).toEqual(undefined);
    expect(notFound).toEqual(undefined);
    expect(weirdInput).toEqual(undefined);
  });

  test('shouldScrubDomain', () => {
    let undefined_url = undefined;
    let secrets_manager_url = 'secretsmanager-test.amazonaws.com';
    let google_url = 'http://google.com/';
    let facebook_url = 'http://test.facebook.io/';
    let instagram_url = 'http://test.instagram.io/';

    expect(shouldScrubDomain(undefined_url)).toEqual(false);
    expect(shouldScrubDomain(secrets_manager_url)).toEqual(true); // checking default scrubbing configuration
    expect(shouldScrubDomain(google_url)).toEqual(false);

    process.env.LUMIGO_DOMAINS_SCRUBBER = '["google"]';
    expect(shouldScrubDomain(google_url)).toEqual(true);

    process.env.LUMIGO_DOMAINS_SCRUBBER = '["google", "facebook"]';
    expect(shouldScrubDomain(facebook_url)).toEqual(true);
    expect(shouldScrubDomain(instagram_url)).toEqual(false);
  });

  test('keyToOmitRegexes', () => {
    process.env[LUMIGO_SECRET_MASKING_REGEX] = ['[".*evilPlan.*"]'];
    expect(keyToOmitRegexes().map(p => String(p))).toEqual(['/.*evilPlan.*/i']);
    process.env[LUMIGO_SECRET_MASKING_REGEX] = undefined;
    process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP] = [
      '[".*evilPlan2.*"]',
    ];
    expect(keyToOmitRegexes().map(p => String(p))).toEqual([
      '/.*evilPlan2.*/i',
    ]);
    process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP] = undefined;
  });

  test('omitKeys', () => {
    const safeObj = { hello: 'world', inner: { check: 'abc' } };
    expect(omitKeys(safeObj)).toEqual(safeObj);

    for (const unsafeKey of [
      'password',
      'secretPassword',
      'secretName',
      'credential',
      'passphrase',
    ]) {
      const unsafeObj = { hello: 'world' };
      unsafeObj[unsafeKey] = 'value';
      const afterOmitted = { hello: 'world' };
      afterOmitted[unsafeKey] = '****';
      expect(omitKeys(unsafeObj)).toEqual(afterOmitted);
    }

    const unsafeInnerObj = { hello: 'world', inner: { secretPassword: 'abc' } };
    expect(omitKeys(unsafeInnerObj)).toEqual({
      hello: 'world',
      inner: { secretPassword: '****' },
    });

    process.env[LUMIGO_SECRET_MASKING_REGEX] = ['[".*evilPlan.*"]'];
    const unpredictedObj = {
      password: 'abc',
      evilPlan: { take: 'over', the: 'world' },
    };
    expect(omitKeys(unpredictedObj)).toEqual({
      password: 'abc',
      evilPlan: '****',
    });
    process.env[LUMIGO_SECRET_MASKING_REGEX] = undefined;

    const unsafeString = '{"hello": "world", "password": "abc"}';
    expect(omitKeys(unsafeString)).toEqual({
      hello: 'world',
      password: '****',
    });

    const notJsonString = '{"hello": "w';
    expect(omitKeys(notJsonString)).toEqual(notJsonString);

    const notString = 5;
    expect(omitKeys(notString)).toEqual(notString);

    const stringNotObject = '5';
    expect(omitKeys(stringNotObject)).toEqual(stringNotObject);

    const unsafeList = [{ password: '123' }, { hello: 'world' }];
    expect(omitKeys(unsafeList)).toEqual([
      { password: '****' },
      { hello: 'world' },
    ]);

    const dummy = {};
    const circularObject = { dummy };
    dummy['circularObject'] = circularObject;
    expect(omitKeys(circularObject)).toEqual({
      dummy: { circularObject: '[Circular]' },
    });

    const nullObject = null;
    expect(omitKeys(nullObject)).toEqual(null);
  });

  test('safeExecute run function', () => {
    expect(safeExecute(() => 5)()).toEqual(5);
  });

  test('safeExecute catch exception', () => {
    safeExecute(() => {
      throw new Error('Mocked error');
    })();
    // No exception.
  });

  test('recursiveGetKey', () => {
    expect(recursiveGetKey({ a: 1 }, 'key')).toEqual(undefined);
    expect(recursiveGetKey({ a: 1, key: { b: 2 } }, 'key')).toEqual({
      b: 2,
    });
    expect(recursiveGetKey({ a: 1, b: { key: { c: 3 } } }, 'key')).toEqual({
      c: 3,
    });

    const circular = { a: 1 };
    circular.b = circular;
    expect(recursiveGetKey(circular, 'key')).toEqual(undefined);
    circular.key = { c: 3 };
    expect(recursiveGetKey(circular, 'key')).toEqual({ c: 3 });

    const tooDeep = { a: { b: { c: { d: { e: { key: "I'm here" } } } } } };
    process.env[GET_KEY_DEPTH_ENV_KEY] = undefined;
    expect(recursiveGetKey(tooDeep, 'key')).toEqual(undefined);
    process.env[GET_KEY_DEPTH_ENV_KEY] = 'bla';
    expect(recursiveGetKey(tooDeep, 'key')).toEqual(undefined);
    process.env[GET_KEY_DEPTH_ENV_KEY] = '8';
    expect(recursiveGetKey(tooDeep, 'key')).toEqual("I'm here");
    process.env[GET_KEY_DEPTH_ENV_KEY] = undefined;
  });
});
