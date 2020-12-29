import * as awsSpan from './awsSpan.js';
import { EXECUTION_TAGS_KEY, getEventEntitySize, parseErrorObject } from '../utils';
import MockDate from 'mockdate';
import { TracerGlobals } from '../globals';
import * as awsParsers from '../parsers/aws';
import * as utils from '../utils';
import { payloadStringify } from '../utils/payloadStringify';
import { HTTP_SPAN } from './awsSpan';
import { HttpSpanBuilder } from '../../testUtils/httpSpanBuilder';

const exampleApiGatewayEvent = require('../testdata/events/apigw-request.json');

jest.mock('../parsers/aws');
describe('awsSpan', () => {
  const spies = {};
  spies['isWarm'] = jest.spyOn(utils, 'isWarm');

  beforeEach(() => {
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

    process.env = { ...awsEnv };

    const token = 'DEADBEEF';

    const awsRequestId = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';
    const functionName = 'w00t';
    const remainingTimeInMillis = 123456;
    const getRemainingTimeInMillis = jest.fn(() => remainingTimeInMillis);
    const awsAccountId = `985323015126`;
    const invokedFunctionArn = `arn:aws:lambda:us-east-1:${awsAccountId}:function:aws-nodejs-dev-hello`;
    const functionVersion = '1';

    const context = {
      awsRequestId,
      functionName,
      invokedFunctionArn,
      functionVersion,
      getRemainingTimeInMillis,
    };
    const event = exampleApiGatewayEvent;

    TracerGlobals.setHandlerInputs({ event, context });
    TracerGlobals.setTracerInputs({ token });
    MockDate.set('05/14/1998');
  });

  test('getSpanInfo', () => {
    const expectedSpanInfo = {
      traceId: {
        Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
        Parent: '28effe37598bb622',
        Sampled: '0',
        transactionId: '64a1b06067c2100c52e51ef4',
      },
      tracer: { name: '@lumigo/tracerMock', version: '1.2.3' },
      logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
      logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
    };
    expect(awsSpan.getSpanInfo(exampleApiGatewayEvent)).toEqual(expectedSpanInfo);
  });

  test('getBasicSpan', () => {
    const expectedBasicSpan = {
      info: {
        traceId: {
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Parent: '28effe37598bb622',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracerMock', version: '1.2.3' },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
      },
      vendor: 'AWS',
      transactionId: '64a1b06067c2100c52e51ef4',
      account: '985323015126',
      memoryAllocated: '1024',
      version: '$LATEST',
      runtime: 'AWS_Lambda_nodejs8.10',
      readiness: 'warm',
      messageVersion: 2,
      token: 'DEADBEEF',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
    };
    spies.isWarm.mockReturnValueOnce(true);

    expect(awsSpan.getBasicSpan('64a1b06067c2100c52e51ef4')).toEqual(expectedBasicSpan);
  });

  test('getBasicSpan turn is warm', () => {
    expect(utils.isWarm()).toEqual(false);
    awsSpan.getBasicSpan();
    expect(utils.isWarm()).toEqual(true);
  });

  test('getFunctionSpan long event being trimmed', () => {
    const expectedStartSpan = {
      info: {
        traceId: {
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Parent: '28effe37598bb622',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracerMock', version: '1.2.3' },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
        httpMethod: 'POST',
        resource: '/{proxy+}',
        stage: 'testStage',
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        triggeredBy: 'apigw',
      },
      vendor: 'AWS',
      transactionId: '64a1b06067c2100c52e51ef4',
      account: '985323015126',
      memoryAllocated: '1024',
      version: '$LATEST',
      runtime: 'AWS_Lambda_nodejs8.10',
      readiness: 'cold',
      messageVersion: 2,
      token: 'DEADBEEF',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started',
      envs: payloadStringify({
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
        LUMIGO_IS_WARM: 'TRUE',
      }),
      name: 'w00t',
      type: 'function',
      ended: 895093200000,
      event: payloadStringify(exampleApiGatewayEvent),
      started: 895093200000,
      maxFinishTime: 895093323456,
    };

    expect(awsSpan.getFunctionSpan()).toEqual(expectedStartSpan);
  });

  test('getFunctionSpan', () => {
    const expectedStartSpan = {
      info: {
        traceId: {
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Parent: '28effe37598bb622',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracerMock', version: '1.2.3' },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
        httpMethod: 'POST',
        resource: '/{proxy+}',
        stage: 'testStage',
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        triggeredBy: 'apigw',
      },
      vendor: 'AWS',
      transactionId: '64a1b06067c2100c52e51ef4',
      account: '985323015126',
      memoryAllocated: '1024',
      version: '$LATEST',
      runtime: 'AWS_Lambda_nodejs8.10',
      readiness: 'cold',
      messageVersion: 2,
      token: 'DEADBEEF',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started',
      envs: payloadStringify({
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
        LUMIGO_IS_WARM: 'TRUE',
      }),
      name: 'w00t',
      type: 'function',
      ended: 895093200000,
      event: payloadStringify(exampleApiGatewayEvent),
      started: 895093200000,
      maxFinishTime: 895093323456,
    };
    expect(awsSpan.getFunctionSpan()).toEqual(expectedStartSpan);
  });

  test('removeStartedFromId', () => {
    const idWithStarted = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started';
    expect(awsSpan.removeStartedFromId(idWithStarted)).toEqual(
      '6d26e3c8-60a6-4cee-8a70-f525f47a4caf'
    );
  });

  test('getEndFunctionSpan', () => {
    const event = { a: 'b', c: 'd' };
    TracerGlobals.setHandlerInputs({ event });

    const functionSpan1 = {
      account: '985323015126',
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started',
      info: {
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        httpMethod: 'POST',
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        resource: '/{proxy+}',
        stage: 'testStage',
        traceId: {
          Parent: '28effe37598bb622',
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracer', version: '0.0.123' },
        triggeredBy: 'apigw',
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      name: 'w00t',
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      started: 895093200000,
      ended: 895093200000,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'function',
      vendor: 'AWS',
      version: '$LATEST',
      envs: null,
      event: null,
      maxFinishTime: 895093323456,
    };

    const expectedFunctionSpan1 = {
      account: '985323015126',
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
      info: {
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        httpMethod: 'POST',
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        resource: '/{proxy+}',
        stage: 'testStage',
        traceId: {
          Parent: '28effe37598bb622',
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracer', version: '0.0.123' },
        triggeredBy: 'apigw',
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      name: 'w00t',
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      started: 895093200000,
      ended: 895179612345,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'function',
      vendor: 'AWS',
      version: '$LATEST',
      error: undefined,
      envs: null,
      event: null,
      maxFinishTime: 895093323456,
      // eslint-disable-next-line camelcase
      return_value: '"data man"',
      [EXECUTION_TAGS_KEY]: [],
    };
    const handlerReturnValue1 = {
      err: null,
      data: 'data man',
      type: 'async_callbacked',
    };
    MockDate.set(895179612345);
    expect(awsSpan.getEndFunctionSpan(functionSpan1, handlerReturnValue1)).toEqual(
      expectedFunctionSpan1
    );

    const err = new Error('new error man');
    const handlerReturnValue2 = {
      err,
      data: undefined,
      type: 'async_callbacked',
    };

    const expectedFunctionSpan2 = {
      account: '985323015126',
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
      info: {
        api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
        httpMethod: 'POST',
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        resource: '/{proxy+}',
        stage: 'testStage',
        traceId: {
          Parent: '28effe37598bb622',
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracer', version: '0.0.123' },
        triggeredBy: 'apigw',
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      name: 'w00t',
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      started: 895093200000,
      ended: 895179612345,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'function',
      vendor: 'AWS',
      version: '$LATEST',
      envs: payloadStringify(process.env),
      error: parseErrorObject(err),
      event: payloadStringify(event),
      maxFinishTime: 895093323456,
      // eslint-disable-next-line camelcase
      return_value: '',
      [EXECUTION_TAGS_KEY]: [],
    };
    MockDate.set(895179612345);
    expect(awsSpan.getEndFunctionSpan(functionSpan1, handlerReturnValue2)).toEqual(
      expectedFunctionSpan2
    );
  });

  test('getEndFunctionSpan with error and big event and envs should have more data than startSpan', () => {
    const longString = 'a'.repeat(getEventEntitySize() * 3);
    let { event, context } = TracerGlobals.getHandlerInputs();
    event = { ...event, longString };
    TracerGlobals.setHandlerInputs({ event, context });
    const envs = { ...process.env, longString };
    process.env = envs;
    const err = new Error('new error man');
    const handlerReturnValue = { err, data: undefined, type: 'async_callbacked' };
    const startSpan = awsSpan.getFunctionSpan();

    const endSpan = awsSpan.getEndFunctionSpan(startSpan, handlerReturnValue);

    expect(endSpan.event).not.toEqual(payloadStringify(event));
    expect(endSpan.event).toEqual(payloadStringify(event, getEventEntitySize() * 2));
    expect(endSpan.event.length).toBeGreaterThan(startSpan.event.length);
    expect(endSpan.envs).not.toEqual(payloadStringify(envs));
    expect(endSpan.envs).toEqual(payloadStringify(envs, getEventEntitySize() * 2));
    expect(endSpan.envs.length).toBeGreaterThan(startSpan.envs.length);
  });

  test('Lambda invoked by S3 -> shouldnt scrub known S3 fields', () => {
    const { context } = TracerGlobals.getHandlerInputs();
    const event = {
      Records: [
        {
          eventSource: 'aws:s3',
          awsRegion: 'us-west-2',
          eventTime: '2020-12-23T08:22:34.629Z',
          eventName: 'ObjectCreated:Put',
          userIdentity: { principalId: 'AMLG687EH3ZOI' },
          requestParameters: { sourceIPAddress: '185.3.145.127' },
          s3: {
            bucket: { arn: 'arn:aws:s3:::tracer-test-nirhod-s3-bucket' },
            object: { key: 'value', size: 2148 },
          },
        },
      ],
    };
    TracerGlobals.setHandlerInputs({ event, context });
    const startSpan = awsSpan.getFunctionSpan();
    expect(JSON.parse(startSpan.event).Records[0].s3.object.key).toEqual('value');
  });

  test('getEndFunctionSpan without error and big event and envs should have same data than startSpan', () => {
    const longString = 'a'.repeat(getEventEntitySize() * 3);
    let { event, context } = TracerGlobals.getHandlerInputs();
    event = { ...event, longString };
    TracerGlobals.setHandlerInputs({ event, context });
    const envs = { ...process.env, longString };
    process.env = envs;
    const handlerReturnValue = { err: null, data: undefined, type: 'async_callbacked' };
    const startSpan = awsSpan.getFunctionSpan();

    const endSpan = awsSpan.getEndFunctionSpan(startSpan, handlerReturnValue);

    expect(endSpan.event).toEqual(payloadStringify(event));
    expect(endSpan.event).toEqual(startSpan.event);
    expect(endSpan.envs).toEqual(payloadStringify(envs));
    expect(endSpan.envs).toEqual(startSpan.envs);
  });

  test('getAwsServiceFromHost', () => {
    const s1 = 'dynamodb';
    const host1 = `${s1}.amazonaws.com`;
    expect(awsSpan.getAwsServiceFromHost(host1)).toEqual(s1);

    const s2 = 'xyz';
    const host2 = `${s2}.cloud.google.com`;
    expect(awsSpan.getAwsServiceFromHost(host2)).toEqual(awsSpan.EXTERNAL_SERVICE);
  });

  test('getAwsServiceFromHost -> api-gw', () => {
    const host1 = `random.random.execute-api.amazonaws.com`;
    expect(awsSpan.getAwsServiceFromHost(host1)).toEqual('apigw');
  });

  // XXX This function is intended to be build upon (i.e. for GCP etc.)
  // that's why it functions the same as getAwsServiceFromHost for now.
  test('getServiceType', () => {
    const s1 = 'dynamodb';
    const host1 = `${s1}.amazonaws.com`;
    expect(awsSpan.getServiceType(host1)).toEqual(s1);

    const s2 = 'xyz';
    const host2 = `${s2}.cloud.google.com`;
    expect(awsSpan.getServiceType(host2)).toEqual(awsSpan.EXTERNAL_SERVICE);
  });

  test('getAwsServicedata', () => {
    const requestData = { a: 'b' };
    const responseData = { d: 'd' };

    requestData.host = `dynamodb.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.dynamodbParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `sns.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.snsParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `lambda.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.lambdaParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `sqs.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.sqsParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `kinesis.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.kinesisParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `events.us-west-2.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.eventBridgeParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `random.random.execute-api.amazonaws.com`;
    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.apigwParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `deadbeef.amazonaws.com`;
    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.awsParser).toHaveBeenCalledWith(requestData, responseData);
  });

  test('getHttpInfo', () => {
    const requestData = {
      host: 'your.mind.com',
      headers: { Tyler: 'Durden', secretKey: 'lumigo' },
      body: 'the first rule of fight club',
    };
    const responseData = {
      headers: { Peter: 'Parker' },
      body: 'Well, Tony is dead.',
    };
    const expected = {
      host: 'your.mind.com',
      request: {
        body: '"the first rule of fight club"',
        headers: '{"Tyler":"Durden","secretKey":"****"}',
        host: 'your.mind.com',
      },
      response: {
        body: '"Well, Tony is dead."',
        headers: '{"Peter":"Parker"}',
      },
    };

    expect(awsSpan.getHttpInfo(requestData, responseData)).toEqual(expected);

    const scrubbedExpected = {
      host: 'your.mind.com',
      request: {
        body: 'The data is not available',
        host: 'your.mind.com',
      },
      response: {
        body: 'The data is not available',
      },
    };

    process.env.LUMIGO_DOMAINS_SCRUBBER = '["mind"]';
    expect(awsSpan.getHttpInfo(requestData, responseData)).toEqual(scrubbedExpected);
  });

  test('getBasicChildSpan', () => {
    const id = 'not-a-random-id';
    const awsRequestId = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';
    const transactionId = '64a1b06067c2100c52e51ef4';

    const expected = {
      info: {
        traceId: {
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Parent: '28effe37598bb622',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracerMock', version: '1.2.3' },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
      },
      vendor: 'AWS',
      transactionId: '64a1b06067c2100c52e51ef4',
      account: '985323015126',
      memoryAllocated: '1024',
      version: '$LATEST',
      runtime: 'AWS_Lambda_nodejs8.10',
      readiness: 'cold',
      messageVersion: 2,
      token: 'DEADBEEF',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id,
      type: 'http',
      parentId: awsRequestId,
      reporterAwsRequestId: awsRequestId,
    };
    expect(
      awsSpan.getBasicChildSpan(
        '64a1b06067c2100c52e51ef4',
        '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
        id,
        HTTP_SPAN
      )
    ).toEqual(expected);

    const spanId = 'abcdefg';
    const expected2 = {
      info: {
        traceId: {
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Parent: '28effe37598bb622',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: { name: '@lumigo/tracerMock', version: '1.2.3' },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
      },
      vendor: 'AWS',
      transactionId: transactionId,
      account: '985323015126',
      memoryAllocated: '1024',
      version: '$LATEST',
      runtime: 'AWS_Lambda_nodejs8.10',
      readiness: 'warm',
      messageVersion: 2,
      token: 'DEADBEEF',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id: spanId,
      type: 'http',
      parentId: awsRequestId,
      reporterAwsRequestId: awsRequestId,
    };
    expect(awsSpan.getBasicChildSpan(transactionId, awsRequestId, spanId, HTTP_SPAN)).toEqual(
      expected2
    );
  });

  test('getHttpSpan ', () => {
    const id = 'not-a-random-id';
    const awsRequestId = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';
    const sendTime = 1234;
    const receivedTime = 1256;

    const requestData = {
      host: 'your.mind.com',
      headers: { Tyler: 'Durden' },
      body: 'the first rule of fight club',
      sendTime,
    };
    const responseData = {
      headers: { Peter: 'Parker' },
      body: 'Well, Tony is dead.',
      statusCode: 200,
      receivedTime,
    };
    const expected = {
      account: '985323015126',
      ended: 1256,
      id: 'not-a-random-id',
      info: {
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
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        traceId: {
          Parent: '28effe37598bb622',
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: {
          name: '@lumigo/tracerMock',
          version: '1.2.3',
        },
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      parentId: awsRequestId,
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      service: 'external',
      started: 1234,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'http',
      vendor: 'AWS',
      version: '$LATEST',
      reporterAwsRequestId: awsRequestId,
    };

    const result = awsSpan.getHttpSpan(
      '64a1b06067c2100c52e51ef4',
      awsRequestId,
      id,
      requestData,
      responseData
    );
    expect(result).toEqual(expected);
  });

  test('getHttpSpan - response with error should double payload size', () => {
    const id = 'not-a-random-id';
    const transcationId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
    const sendTime = 1234;
    const receivedTime = 1256;
    const longString = 'a'.repeat(getEventEntitySize() * 2);
    const requestData = {
      host: 'your.mind.com',
      headers: { longString },
      body: longString,
      sendTime,
    };
    const responseDataSuccess = {
      headers: { longString },
      body: longString,
      statusCode: 200,
      receivedTime,
    };
    const responseDataFailed = {
      headers: { longString },
      body: longString,
      statusCode: 404,
      receivedTime,
    };

    const spanSuccess = awsSpan.getHttpSpan(
      transcationId,
      id,
      id,
      requestData,
      responseDataSuccess
    );
    const spanError = awsSpan.getHttpSpan(transcationId, id, id, requestData, responseDataFailed);
    expect(spanError.info.httpInfo.request.body.length).toBeGreaterThan(
      spanSuccess.info.httpInfo.request.body.length * 1.8 + 1
    );
    expect(spanError.info.httpInfo.request.headers.length).toBeGreaterThan(
      spanSuccess.info.httpInfo.request.headers.length * 1.8 + 1
    );
    expect(spanError.info.httpInfo.response.body.length).toBeGreaterThan(
      spanSuccess.info.httpInfo.response.body.length * 1.8 + 1
    );
    expect(spanError.info.httpInfo.response.headers.length).toBeGreaterThan(
      spanSuccess.info.httpInfo.response.headers.length * 1.8 + 1
    );
  });

  test('getHttpSpan - only for request data', () => {
    const id = 'not-a-random-id';
    const sendTime = 1234;
    const awsRequestId = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';

    const requestData = {
      host: 'your.mind.com',
      headers: { Tyler: 'Durden' },
      body: 'the first rule of fight club',
      sendTime,
    };
    const expected = {
      account: '985323015126',
      ended: undefined,
      id: 'not-a-random-id',
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            body: '"the first rule of fight club"',
            headers: '{"Tyler":"Durden"}',
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {},
        },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        traceId: {
          Parent: '28effe37598bb622',
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: {
          name: '@lumigo/tracerMock',
          version: '1.2.3',
        },
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      parentId: awsRequestId,
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      service: 'external',
      started: 1234,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'http',
      vendor: 'AWS',
      version: '$LATEST',
      reporterAwsRequestId: awsRequestId,
    };

    const result = awsSpan.getHttpSpan('64a1b06067c2100c52e51ef4', awsRequestId, id, requestData);
    expect(result).toEqual(expected);
  });

  test('getHttpSpan - different parent id & reporter request id', () => {
    const id = 'not-a-random-id';
    const sendTime = 1234;
    const reporterRequestId = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';
    const awsRequestId = 'DummyReq';

    const requestData = {
      host: 'your.mind.com',
      headers: { Tyler: 'Durden' },
      body: 'the first rule of fight club',
      sendTime,
    };
    const expected = {
      account: '985323015126',
      ended: undefined,
      id: 'not-a-random-id',
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            body: '"the first rule of fight club"',
            headers: '{"Tyler":"Durden"}',
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {},
        },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        traceId: {
          Parent: '28effe37598bb622',
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: {
          name: '@lumigo/tracerMock',
          version: '1.2.3',
        },
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      parentId: awsRequestId,
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn: 'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      service: 'external',
      started: 1234,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'http',
      vendor: 'AWS',
      version: '$LATEST',
      reporterAwsRequestId: reporterRequestId,
    };

    const result = awsSpan.getHttpSpan('64a1b06067c2100c52e51ef4', awsRequestId, id, requestData);
    expect(result).toEqual(expected);
  });

  test('getHttpSpan - handle failing when parsing AWS service data', () => {
    const id = 'not-a-random-id';
    const sendTime = 1234;

    const requestData = {
      get host() {
        return {
          includes: () => {
            throw Error();
          },
        };
      },
      headers: { Tyler: 'Durden' },
      body: 'the first rule of fight club',
      sendTime,
    };

    const result = awsSpan.getHttpSpan('', '', id, requestData);
    expect(result.service).toEqual('external');
  });

  test('getHttpSpanId - simple flow', () => {
    const result = awsSpan.getHttpSpanId('DummyRandom', 'DummyAws');
    expect(result).toEqual('DummyAws');
  });

  test('getHttpSpanId - no aws request id', () => {
    const result = awsSpan.getHttpSpanId('DummyRandom');
    expect(result).toEqual('DummyRandom');
  });

  test('getHttpSpanTimings', () => {
    const sendTime = 1234;
    const receivedTime = 1256;
    const requestData = { sendTime };
    const responseData = { receivedTime };
    expect(awsSpan.getHttpSpanTimings(requestData, responseData)).toEqual({
      started: sendTime,
      ended: receivedTime,
    });
  });

  test('addRttToFunctionSpan', () => {
    const functionSpan = { a: 'b' };
    const rtt = 1234;
    // eslint-disable-next-line camelcase
    const expected = { reporter_rtt: rtt, ...functionSpan };
    expect(awsSpan.addRttToFunctionSpan(functionSpan, rtt)).toEqual(expected);
  });
});
