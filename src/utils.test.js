import crypto from 'crypto';
import { ConsoleWritesForTesting } from '../testUtils/consoleMocker';
import { HandlerInputsBuilder } from '../testUtils/handlerInputsBuilder';
import * as globals from './globals';
import { MAX_TRACER_ADDED_DURATION_ALLOWED, TracerGlobals } from './globals';
import * as logger from './logger';
import * as utils from './utils';
import {
  DEFAULT_AUTO_TAG_KEY,
  DEFAULT_CONNECTION_TIMEOUT,
  DEFAULT_TIMEOUT_MIN_DURATION,
  filterObjectKeys,
  getEnvVarAsList,
  getJSONBase64Size,
  GET_KEY_DEPTH_ENV_KEY,
  isDebug,
  isEmptyString,
  isEncodingType,
  isObject,
  DEFAULT_LUMIGO_MAX_ENTRY_SIZE,
  parseErrorObject,
  parseQueryParams,
  recursiveGetKey,
  removeDuplicates,
  safeExecute,
  safeGet,
  safeJsonParse,
  shouldPropagateW3C,
  shouldScrubDomain,
  getTraceId,
} from './utils';

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

    const awsXAmznLineageParentTraceId =
      'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Sampled=1;Parent=59fa1aeb03c2ec1f;Lineage=a87bd80c:1|68fd508a:5|c512fbe3:2';
    const LineageParentExpected = {
      Parent: '59fa1aeb03c2ec1f',
      Root: '1-5b1d2450-6ac46730d346cad0e53f89d0',
      Sampled: '1',
      transactionId: '6ac46730d346cad0e53f89d0',
      Lineage: 'a87bd80c:1|68fd508a:5|c512fbe3:2',
    };
    expect(utils.getTraceId(awsXAmznLineageParentTraceId)).toEqual(LineageParentExpected);

    const awsXAmznLineageNoParentTraceId =
      'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Sampled=1;Lineage=a87bd80c:1|68fd508a:5|c512fbe3:2\n';
    const lineageNoParentActual = utils.getTraceId(awsXAmznLineageNoParentTraceId);
    expect(lineageNoParentActual.Root).toEqual('1-5b1d2450-6ac46730d346cad0e53f89d0');
    expect(lineageNoParentActual.transactionId).toEqual('6ac46730d346cad0e53f89d0');
    expect(lineageNoParentActual.Parent).toBeTruthy();

    expect(utils.getTraceId(null)).toEqual({
      Root: 'f585f41',
      Parent: '5f585f414d5a4e5f54524143',
      Sampled: '1',
      transactionId: '5f585f414d5a4e5f54524143',
    });

    expect(utils.getTraceId('x;y')).toEqual({
      Root: '83b7978',
      Parent: '783b79783b79783b79783b79',
      Sampled: '1',
      transactionId: '783b79783b79783b79783b79',
    });

    expect(utils.getTraceId('a=b;c=d;e=f')).toEqual({
      Root: '13d623b',
      Parent: '613d623b633d643b653d6661',
      Sampled: '1',
      transactionId: '613d623b633d643b653d6661',
    });
  });

  test('isObject', () => {
    expect(isObject([])).toEqual(false);
    expect(isObject(true)).toEqual(false);
    expect(isObject(undefined)).toEqual(false);
    expect(isObject(null)).toEqual(false);
    expect(isObject(43)).toEqual(false);
    expect(isObject('text')).toEqual(false);
    expect(isObject({})).toEqual(true);
  });

  test('getPatchedTraceId', () => {
    const awsXAmznTraceId =
      'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';
    const expectedRoot = 'Root=1';
    const expectedSuffix = '6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';

    const result = utils.getPatchedTraceId(awsXAmznTraceId);

    const [resultRoot, resultTime, resultSuffix] = result.split('-');
    expect(resultRoot).toEqual(expectedRoot);
    expect(resultSuffix).toEqual(expectedSuffix);

    const timeDiff = Date.now() - 1000 * parseInt(resultTime, 16);
    expect(timeDiff).toBeGreaterThan(0);
    expect(timeDiff).toBeLessThan(1500);
  });

  test('getAWSEnvironment', () => {
    const oldEnv = Object.assign({}, process.env);
    const awsEnv = {
      LAMBDA_TASK_ROOT: '/var/task',
      LAMBDA_RUNTIME_DIR: '/var/runtime',
      AWS_REGION: 'us-east-1',
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_LAMBDA_LOG_GROUP_NAME: '/aws/lambda/aws-nodejs-dev-hello',
      AWS_LAMBDA_LOG_STREAM_NAME: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
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
      awsLambdaLogStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
      awsLambdaRuntimeDir: '/var/runtime',
      awsLambdaTaskRoot: '/var/task',
      awsRegion: 'us-east-1',
      awsXAmznTraceId: 'Root=1-5cdcf03a-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0',
    };
    expect(utils.getAWSEnvironment()).toEqual(expected);
    process.env = { ...oldEnv };
  });

  test('isAwsEnvironment', () => {
    process.env = {};
    expect(utils.isAwsEnvironment()).toBe(false);
    process.env.LAMBDA_RUNTIME_DIR = 'BLA BLA';
    expect(utils.isAwsEnvironment()).toBe(true);
  });

  test('isScrubKnownServicesOn', () => {
    expect(utils.isScrubKnownServicesOn()).toBe(false);
    process.env.LUMIGO_SCRUB_KNOWN_SERVICES = 'true';
    expect(utils.isScrubKnownServicesOn()).toBe(true);
  });

  test('isVerboseMode', () => {
    expect(utils.isVerboseMode()).toBe(false);
    process.env.LUMIGO_VERBOSE = 'TRUE';
    expect(utils.isVerboseMode()).toBe(true);
  });

  test('isStoreLogs', () => {
    expect(utils.isStoreLogs()).toBe(false);
    process.env.LUMIGO_STORE_LOGS = 'TRUE';
    expect(utils.isStoreLogs()).toBe(true);
  });

  test('isKeepHeadersOn', () => {
    expect(utils.isKeepHeadersOn()).toBe(false);
    process.env.LUMIGO_KEEP_HTTP_HEADERS = 'TRUE';
    expect(utils.isKeepHeadersOn()).toBe(true);
  });

  test('isWarm', () => {
    expect(utils.isWarm()).toBe(false);
    process.env.LUMIGO_IS_WARM = 'TRUE';
    expect(utils.isWarm()).toBe(true);
  });

  test('isDebug -> ENV VAR', () => {
    expect(utils.isDebug()).toBe(false);
    process.env.LUMIGO_DEBUG = 'TRUE';
    expect(utils.isDebug()).toBe(true);
  });

  test('isDebug -> TracerInputs', () => {
    expect(utils.isDebug()).toBe(false);
    globals.TracerGlobals.setTracerInputs({ debug: true });
    expect(utils.isDebug()).toBe(true);
  });

  test('isLambdaWrapped', () => {
    expect(utils.isLambdaWrapped()).toBe(false);
    process.env.LUMIGO_IS_WRAPPED = 'TRUE';
    expect(utils.isLambdaWrapped()).toBe(true);
  });

  test('shouldPropagateW3C', () => {
    delete process.env.LUMIGO_PROPAGATE_W3C;
    expect(shouldPropagateW3C()).toBe(true);
    process.env.LUMIGO_PROPAGATE_W3C = 'TRUE';
    expect(shouldPropagateW3C()).toBe(true);
    process.env.LUMIGO_PROPAGATE_W3C = 'FALSE';
    expect(shouldPropagateW3C()).toBe(false);
  });

  test('setLambdaWrapped', () => {
    utils.setLambdaWrapped();
    expect(utils.isLambdaWrapped()).toBe(true);
  });

  test('isSendOnlyIfErrors', () => {
    expect(utils.isSendOnlyIfErrors()).toBe(false);
    process.env.SEND_ONLY_IF_ERROR = 'TRUE';
    expect(utils.isSendOnlyIfErrors()).toBe(true);
  });

  test('isPruneTraceOff', () => {
    expect(utils.isPruneTraceOff()).toBe(false);
    process.env.LUMIGO_PRUNE_TRACE_OFF = 'TRUE';
    expect(utils.isPruneTraceOff()).toBe(true);
  });

  test('isTimeoutTimerEnabled', () => {
    expect(utils.isTimeoutTimerEnabled()).toBe(true);
    process.env.LUMIGO_TIMEOUT_TIMER_ENABLED = 'FALSE';
    expect(utils.isTimeoutTimerEnabled()).toBe(false);
  });

  test('getEventEntitySize MAX_EVENT_ENTITY_SIZE', () => {
    expect(utils.getEventEntitySize()).toBe(DEFAULT_LUMIGO_MAX_ENTRY_SIZE);
    expect(utils.getEventEntitySize(true)).toBe(DEFAULT_LUMIGO_MAX_ENTRY_SIZE * 2);
    process.env.MAX_EVENT_ENTITY_SIZE = '2048';
    expect(utils.getEventEntitySize()).toBe(2048);
  });

  test('getEventEntitySize LUMIGO_MAX_ENTRY_SIZE', () => {
    delete process.env.MAX_EVENT_ENTITY_SIZE;
    process.env.LUMIGO_MAX_ENTRY_SIZE = '2048';
    expect(utils.getEventEntitySize()).toBe(2048);
  });

  test('getEventEntitySize LUMIGO_MAX_ENTRY_SIZE_ON_ERROR', () => {
    delete process.env.MAX_EVENT_ENTITY_SIZE_ON_ERROR;
    process.env.LUMIGO_MAX_ENTRY_SIZE_ON_ERROR = '10000';
    expect(utils.getEventEntitySize(true)).toBe(10000);
  });

  test('getEventEntitySize LUMIGO_MAX_ENTRY_SIZE_ON_ERROR is 2x LUMIGO_MAX_ENTRY_SIZE', () => {
    delete process.env.MAX_EVENT_ENTITY_SIZE;
    process.env.LUMIGO_MAX_ENTRY_SIZE = '4096';
    expect(utils.getEventEntitySize(true)).toBe(4096 * 2);
  });

  test('getEventEntitySize NaN', () => {
    process.env.MAX_EVENT_ENTITY_SIZE = 'A 2048';
    expect(utils.getEventEntitySize()).toBe(DEFAULT_LUMIGO_MAX_ENTRY_SIZE);
  });

  test('getConnectionTimeout => simple flow', () => {
    process.env.LUMIGO_CONNECTION_TIMEOUT = '600';
    expect(utils.getConnectionTimeout()).toBe(600);
  });

  test('getRequestTimeout => simple flow', () => {
    process.env.LUMIGO_REQUEST_TIMEOUT_MS = '600';
    expect(utils.getRequestTimeout()).toBe(600);
  });

  test('getConnectionTimeout => default value', () => {
    expect(utils.getConnectionTimeout()).toBe(DEFAULT_CONNECTION_TIMEOUT);
  });

  test('getConnectionTimeout => NaN', () => {
    process.env.LUMIGO_CONNECTION_TIMEOUT = 'A 20,,48 A';
    expect(utils.getConnectionTimeout()).toBe(DEFAULT_CONNECTION_TIMEOUT);
  });

  test('setWarm', () => {
    expect(utils.isWarm()).toBe(false);
    utils.setWarm();
    expect(utils.isWarm()).toBe(true);
  });

  test('isWarm in provisioned concurrency', () => {
    process.env.AWS_LAMBDA_INITIALIZATION_TYPE = 'provisioned-concurrency';
    expect(utils.isWarm()).toBe(true);
    utils.setWarm();
    expect(utils.isWarm()).toBe(true);
    process.env.AWS_LAMBDA_INITIALIZATION_TYPE = undefined;
  });

  test('setStoreLogsOn', () => {
    expect(utils.isStoreLogs()).toBe(false);
    utils.setStoreLogsOn();
    expect(utils.isStoreLogs()).toBe(true);
  });

  test('isReuseHttpConnection', () => {
    expect(utils.isReuseHttpConnection()).toBe(false);
    process.env['LUMIGO_REUSE_HTTP_CONNECTION'] = 'TRUE';
    expect(utils.isReuseHttpConnection()).toBe(true);
  });

  test('setSendOnlyIfErrors', () => {
    expect(utils.isSendOnlyIfErrors()).toBe(false);
    utils.setSendOnlyIfErrors();
    expect(utils.isSendOnlyIfErrors()).toBe(true);
  });

  test('setTimeoutTimerDisabled', () => {
    expect(utils.isTimeoutTimerEnabled()).toBe(true);
    utils.setTimeoutTimerDisabled();
    expect(utils.isTimeoutTimerEnabled()).toBe(false);
  });

  test('setPruneTraceOff', () => {
    expect(utils.isPruneTraceOff()).toBe(false);
    utils.setPruneTraceOff();
    expect(utils.isPruneTraceOff()).toBe(true);
  });

  test('getInvokedAliasOrNullInvalidArn', () => {
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'bad-format',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.clearHandlerInputs();
  });

  test('isSwitchedOff -> TracerInputs', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    TracerGlobals.setTracerInputs({
      switchOff: true,
    });
    expect(utils.isSwitchedOff()).toBe(true);
  });

  test('isSwitchedOffInvalidAlias', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:alias',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });
    process.env['LUMIGO_VALID_ALIASES'] = '["wrong"]';
    expect(utils.isSwitchedOff()).toBe(true);
    TracerGlobals.clearHandlerInputs();
  });

  test('isSwitchedOffInvalidAlias -> no alias', () => {
    process.env['LUMIGO_VALID_ALIASES'] = '["wrong"]';
    expect(utils.isSwitchedOff()).toBe(false);
  });

  test('isSwitchedOffValidAlias', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:alias',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });
    process.env['LUMIGO_VALID_ALIASES'] = '["alias"]';
    expect(utils.isSwitchedOff()).toBe(false);
    TracerGlobals.clearHandlerInputs();
  });

  test('getInvokedAliasOrNull', () => {
    expect(utils.getInvokedAliasOrNull()).toBe(null);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:alias',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual('alias');
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'bad-arn',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        no: 'arn',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });
    expect(utils.getInvokedAliasOrNull()).toEqual(null);
    TracerGlobals.clearHandlerInputs();
  });

  test('isValidAlias', () => {
    expect(utils.isValidAlias()).toEqual(true);
    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:currentAlias',
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
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

  test('getAgentKeepAlive -> ENV_VAR', () => {
    process.env['LUMIGO_AGENT_KEEPALIVE_MS'] = '350';
    expect(utils.getAgentKeepAlive()).toEqual(350);
  });

  test('getAgentKeepAlive -> default', () => {
    expect(utils.getAgentKeepAlive()).toEqual(undefined);
  });

  test('getTimeoutMinDuration -> ENV_VAR', () => {
    process.env['LUMIGO_TIMEOUT_MIN_DURATION'] = '500';
    expect(utils.getTimeoutMinDuration()).toEqual(500);
  });

  test('getTimeoutMinDuration -> default', () => {
    expect(utils.getTimeoutMinDuration()).toEqual(DEFAULT_TIMEOUT_MIN_DURATION);
  });

  test('getTimeoutTimerBuffer -> ENV_VAR', () => {
    process.env['LUMIGO_TIMEOUT_BUFFER'] = '0.35';
    expect(utils.getTimeoutTimerBuffer()).toEqual(350);
  });

  test('getTimeoutTimerBuffer -> ENV_VAR ms', () => {
    process.env['LUMIGO_TIMEOUT_BUFFER_MS'] = '350';
    expect(utils.getTimeoutTimerBuffer()).toEqual(350);
  });

  test('getTimeoutTimerBuffer -> Min value', () => {
    expect(utils.isValidAlias()).toEqual(true);
    TracerGlobals.setHandlerInputs({
      context: {
        getRemainingTimeInMillis: () => 1000,
      },
    });
    expect(utils.getTimeoutTimerBuffer()).toEqual(500);
  });

  test('getTimeoutTimerBuffer -> Max value', () => {
    expect(utils.isValidAlias()).toEqual(true);
    TracerGlobals.setHandlerInputs({
      context: {
        getRemainingTimeInMillis: () => 60000,
      },
    });
    expect(utils.getTimeoutTimerBuffer()).toEqual(3000);
  });

  test('getTimeoutTimerBuffer -> 10% of the run time', () => {
    expect(utils.isValidAlias()).toEqual(true);
    TracerGlobals.setHandlerInputs({
      context: {
        getRemainingTimeInMillis: () => 20000,
      },
    });
    expect(utils.getTimeoutTimerBuffer()).toEqual(2000);
  });

  test('getTracerMaxDurationTimeout -> ENV_VAR', () => {
    process.env.LUMIGO_TRACER_TIMEOUT = '111';
    expect(utils.getTracerMaxDurationTimeout()).toEqual(111);
  });

  test('getTracerMaxDurationTimeout -> default value', () => {
    expect(utils.getTracerMaxDurationTimeout()).toEqual(750);
  });

  test('getTracerMaxDurationTimeout -> Max value', () => {
    const inputs = new HandlerInputsBuilder().withTimeout(6000000).build();
    TracerGlobals.setHandlerInputs(inputs);
    expect(utils.getTracerMaxDurationTimeout()).toEqual(750);
  });

  test('getTracerMaxDurationTimeout -> min value', () => {
    const inputs = new HandlerInputsBuilder().withTimeout(1000).build();
    TracerGlobals.setHandlerInputs(inputs);
    expect(utils.getTracerMaxDurationTimeout()).toEqual(200);
  });

  test('getTracerMaxDurationTimeout -> in between', () => {
    const inputs = new HandlerInputsBuilder().withTimeout(2000).build();
    TracerGlobals.setHandlerInputs(inputs);
    expect(utils.getTracerMaxDurationTimeout()).toEqual(400);
  });

  test('setSwitchOff', () => {
    expect(utils.isSwitchedOff()).toBe(false);
    utils.setSwitchOff();
    TracerGlobals.setTracerInputs({});
    expect(utils.isSwitchedOff()).toBe(true);
  });

  test('setDebug', () => {
    expect(isDebug()).toBe(false);
    utils.setDebug();
    TracerGlobals.setTracerInputs({});
    expect(isDebug()).toBe(true);
  });

  test('isString', () => {
    expect(utils.isString('asdf')).toBe(true);
    expect(utils.isString({ satoshi: 'nakamoto' })).toBe(false);
  });

  test('parseJsonFromEnvVar -> simple flow', () => {
    process.env.TEST_STR = '"TEST"';
    process.env.TEST_NUM = '1';
    process.env.TEST_ARRAY = '[1, "1"]';
    process.env.TEST_OBJECT = '{"1": "1"}';

    expect(utils.parseJsonFromEnvVar('TEST_STR')).toEqual('TEST');
    expect(utils.parseJsonFromEnvVar('TEST_NUM')).toEqual(1);
    expect(utils.parseJsonFromEnvVar('TEST_ARRAY')).toEqual([1, '1']);
    expect(utils.parseJsonFromEnvVar('TEST_OBJECT')).toEqual({ '1': '1' });
  });

  test('parseJsonFromEnvVar -> not fail on error', () => {
    process.env.TEST_ERR = 'ERR';
    expect(utils.parseJsonFromEnvVar('TEST_ERR')).toEqual(undefined);
  });

  test('parseJsonFromEnvVar -> warn user', () => {
    process.env.TEST_ERR = 'ERR';

    utils.parseJsonFromEnvVar('TEST_ERR', true);

    expect(ConsoleWritesForTesting.getLogs()).toEqual([
      {
        msg: 'Lumigo Warning: TEST_ERR need to be a valid JSON',
        obj: undefined,
      },
    ]);
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
        '    at Object.normalizeLambdaError (/opt/nodejs/node_modules/@lumigo/tracer/dist/tracer.js:210:15)\n' +
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
        '    at new Promise (<anonymous>)\n' +
        '    at Runtime.handleOnce (/var/runtime/Runtime.js:63:25)\n' +
        '    at process._tickCallback (internal/process/next_tick.js:68:7)',
    };

    const expectedHandlerReturnValue = { err: expectedErr, data, type };

    expect(utils.removeLumigoFromStacktrace(handlerReturnValue)).toEqual(
      expectedHandlerReturnValue
    );

    expect(utils.removeLumigoFromStacktrace({ err: null, data: 'y', type: 'x' })).toEqual({
      err: null,
      data: 'y',
      type: 'x',
    });
  });

  test('removeLumigoFromStacktrace - anonymous func', () => {
    const err = {
      stack: `at createError (/var/task/node_modules/axios/lib/core/createError.js:16:15)
    at settle (/var/task/node_modules/axios/lib/core/settle.js:17:12)
    at IncomingMessage.handleStreamEnd (/var/task/node_modules/axios/lib/adapters/http.js:236:11)
    at IncomingMessage.emit (events.js:203:15)
    at IncomingMessage.EventEmitter.emit (domain.js:448:20)
    at IncomingMessage.<anonymous> (/var/task/node_modules/@lumigo/tracer/dist/lumigo.js:27:18868)
    at endReadableNT (_stream_readable.js:1145:12)
    at process._tickCallback (internal/process/next_tick.js:63:19)`,
    };
    const data = 'abcd';
    const type = '1234';
    const handlerReturnValue = { err, data, type };

    const expectedErr = {
      stack: `at createError (/var/task/node_modules/axios/lib/core/createError.js:16:15)
    at settle (/var/task/node_modules/axios/lib/core/settle.js:17:12)
    at IncomingMessage.handleStreamEnd (/var/task/node_modules/axios/lib/adapters/http.js:236:11)
    at IncomingMessage.emit (events.js:203:15)
    at IncomingMessage.EventEmitter.emit (domain.js:448:20)
    at endReadableNT (_stream_readable.js:1145:12)
    at process._tickCallback (internal/process/next_tick.js:63:19)`,
    };

    const expectedHandlerReturnValue = { err: expectedErr, data, type };

    expect(utils.removeLumigoFromStacktrace(handlerReturnValue)).toEqual(
      expectedHandlerReturnValue
    );
  });

  test('removeLumigoFromStacktrace no exception', () => {
    utils.removeLumigoFromStacktrace(null);
    // No exception.
  });

  test('getEdgeHost', () => {
    TracerGlobals.setTracerInputs({ token: '', edgeHost: 'zarathustra.com' });
    expect(utils.getEdgeHost()).toEqual('zarathustra.com');

    TracerGlobals.setTracerInputs({ token: '', edgeHost: '' });

    expect(utils.getEdgeHost()).toEqual('us-east-1.lumigo-tracer-edge.golumigo.com');
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
      url: 'https://us-east-1.lumigo-tracer-edge.golumigo.com/api/spans',
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

  test('parseQueryParams invalid URI', () => {
    const queryParams = 'a=%E0%A4%A';
    const parsed = parseQueryParams(queryParams);
    expect(parsed).toEqual({});
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
    let undefinedUrl = undefined;
    let secretsManagerUrl = 'secretsmanager-test.amazonaws.com';
    let googleUrl = 'http://google.com/';
    let facebookUrl = 'http://test.facebook.io/';
    let instagramUrl = 'http://test.instagram.io/';

    expect(shouldScrubDomain(undefinedUrl)).toEqual(false);
    expect(shouldScrubDomain(secretsManagerUrl)).toEqual(true); // checking default scrubbing configuration
    expect(shouldScrubDomain(googleUrl)).toEqual(false);

    process.env.LUMIGO_DOMAINS_SCRUBBER = '["google"]';
    expect(shouldScrubDomain(googleUrl)).toEqual(true);

    process.env.LUMIGO_DOMAINS_SCRUBBER = '["google", "facebook"]';
    expect(shouldScrubDomain(facebookUrl)).toEqual(true);
    expect(shouldScrubDomain(instagramUrl)).toEqual(false);
  });

  test('safeExecute run function', () => {
    expect(safeExecute(() => 5)()).toEqual(5);
  });

  test('safeExecute - parameters', () => {
    expect(safeExecute((param) => param)(5)).toEqual(5);
  });

  test('safeExecute catch exception', () => {
    safeExecute(() => {
      throw new Error('Mocked error');
    })();
    // No exception.
  });
  test('safeExecute catch exception with default value', () => {
    const result = safeExecute(
      () => {
        throw new Error('Mocked error');
      },
      'm',
      logger.LOG_LEVELS.WARNING,
      'defaultValue'
    )();
    expect(result).toEqual('defaultValue');
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
  test('getEnvVarAsList not existing key', () => {
    const res = getEnvVarAsList('not_exists', 'def');
    expect(res).toEqual('def');
  });

  test('getEnvVarAsList existing key', () => {
    process.env['array_key'] = 'a,b,c';
    const res = getEnvVarAsList('array_key');
    expect(res).toEqual(['a', 'b', 'c']);
  });

  test('isEncodingType -> empty case', () => {
    expect(isEncodingType()).toEqual(false);
    expect(isEncodingType(null)).toEqual(false);
    expect(isEncodingType(undefined)).toEqual(false);
  });

  test('isEncodingType -> not valid types', () => {
    expect(isEncodingType(1)).toEqual(false);
    expect(isEncodingType([])).toEqual(false);
    expect(isEncodingType({})).toEqual(false);
  });

  test('isEncodingType -> not valid encoding', () => {
    expect(isEncodingType('utf99')).toEqual(false);
  });

  test('isEncodingType -> simple flow', () => {
    expect(isEncodingType('ascii')).toEqual(true);
    expect(isEncodingType('utf8')).toEqual(true);
    expect(isEncodingType('utf16le')).toEqual(true);
    expect(isEncodingType('ucs2')).toEqual(true);
    expect(isEncodingType('base64')).toEqual(true);
    expect(isEncodingType('binary')).toEqual(true);
    expect(isEncodingType('hex')).toEqual(true);
  });

  test('isEmptyString', () => {
    expect(isEmptyString('str')).toEqual(false);
    expect(isEmptyString('')).toEqual(true);

    expect(isEmptyString(null)).toEqual(true);
    expect(isEmptyString(undefined)).toEqual(true);
    expect(isEmptyString()).toEqual(true);
    expect(isEmptyString([])).toEqual(false);
    expect(isEmptyString({})).toEqual(false);
  });

  test('safeGet happyFlow', () => {
    expect(safeGet({ a: { b: 'c' } }, ['a', 'b'])).toEqual('c');
  });

  test('safeGet happyFlow with array', () => {
    expect(safeGet({ a: { b: ['c', 'd'] } }, ['a', 'b', 1])).toEqual('d');
  });

  test('safeGet default flow', () => {
    expect(safeGet({ a: { b: 'c' } }, ['a', 'b', 'arg'], 'dflt')).toEqual('dflt');
  });

  test('safeJsonParse happy flow', () => {
    expect(safeJsonParse('{ "a": { "b": "c" } }')).toEqual({ a: { b: 'c' } });
  });

  test('safeJsonParse bad json', () => {
    expect(safeJsonParse('{ "a": { "b": "c"')).toBeUndefined();
  });

  test('safeJsonParse bad json with default', () => {
    expect(safeJsonParse('{ "a": { "b": "c"', { c: 'd' })).toEqual({ c: 'd' });
  });

  test('removeDuplicates happy flow', () => {
    expect(removeDuplicates([1, 2, 3, 3, 2])).toEqual([1, 2, 3]);
  });

  test('removeDuplicates empty list', () => {
    expect(removeDuplicates([])).toEqual([]);
  });

  test('getAutoTagKeys', () => {
    const oldEnv = Object.assign({}, process.env);

    // default tags
    process.env = {};
    expect(utils.getAutoTagKeys()).toEqual([DEFAULT_AUTO_TAG_KEY]);

    // error in parse
    process.env = { LUMIGO_AUTO_TAG: null };
    expect(utils.getAutoTagKeys()).toEqual([DEFAULT_AUTO_TAG_KEY]);

    // happy flow
    process.env = { LUMIGO_AUTO_TAG: 'key1,key2' };
    expect(utils.getAutoTagKeys()).toEqual(['key1', 'key2']);

    process.env = { ...oldEnv };
  });

  test('filterObjectKeys => simple flow', () => {
    const obj = {
      aa: 1,
      bb: 2,
      _asdads: 3,
    };

    const result = filterObjectKeys(obj, (key) => !key.startsWith('_'));

    expect(result).toEqual({
      aa: 1,
      bb: 2,
    });
  });
});
