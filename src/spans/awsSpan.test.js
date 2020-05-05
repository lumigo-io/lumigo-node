import * as awsSpan from './awsSpan.js';
import { parseErrorObject } from '../utils';
import MockDate from 'mockdate';
import { TracerGlobals } from '../globals';
import * as awsParsers from '../parsers/aws';
import * as utils from '../utils';

const exampleApiGatewayEvent = require('../testdata/events/apigw-request.json');

jest.mock('../parsers/aws');
describe('awsSpan', () => {
  const spies = {};
  const oldEnv = Object.assign({}, process.env);
  spies['isWarm'] = jest.spyOn(utils, 'isWarm');

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

  afterEach(() => {
    process.env = { ...oldEnv };
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
    expect(awsSpan.getSpanInfo(exampleApiGatewayEvent)).toEqual(
      expectedSpanInfo
    );
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
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
    };
    spies.isWarm.mockReturnValueOnce(true);

    expect(awsSpan.getBasicSpan()).toEqual(expectedBasicSpan);
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
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started',
      envs:
        '{"LAMBDA_TASK_ROOT":"/var/task","LAMBDA_RUNTIME_DIR":"/var/runtime","AWS_REGION":"us-east-1","AWS_DEFAULT_REGION":"us-east-1","AWS_LAMBDA_LOG_GROUP_NAME":"/aws/lambda/aws-nodejs-dev-hello","AWS_LAMBDA_LOG_STREAM_NAME":"2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73","AWS_LAMBDA_FUNCTION_NAME":"aws-nodejs-dev-hello","AWS_LAMBDA_FUNCTION_MEMORY_SIZE":"1024","AWS_LAMBDA_FUNCTION_VERSION":"$LATEST","_AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2","_AWS_XRAY_DAEMON_PORT":"2000","AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2:2000","AWS_XRAY_CONTEXT_MISSING":"LOG_ERROR","_X_AMZN_TRACE_ID":"Root=1-5cdcf03a-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0","AWS_EXECUTION_ENV":"AWS_Lambda_nodejs8.10","MAX_EVENT_ENTITY_SIZE":"10","LUMIGO_IS_WARM":"TRUE"}',
      name: 'w00t',
      type: 'function',
      ended: 895093200000,
      event: '{"resource',
      started: 895093200000,
      maxFinishTime: 895093323456,
    };

    const oldEnv = Object.assign({}, process.env);
    process.env = { ...oldEnv, MAX_EVENT_ENTITY_SIZE: '10' };
    expect(awsSpan.getFunctionSpan()).toEqual(expectedStartSpan);

    process.env = { ...oldEnv };
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
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started',
      envs:
        '{"LAMBDA_TASK_ROOT":"/var/task","LAMBDA_RUNTIME_DIR":"/var/runtime","AWS_REGION":"us-east-1","AWS_DEFAULT_REGION":"us-east-1","AWS_LAMBDA_LOG_GROUP_NAME":"/aws/lambda/aws-nodejs-dev-hello","AWS_LAMBDA_LOG_STREAM_NAME":"2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73","AWS_LAMBDA_FUNCTION_NAME":"aws-nodejs-dev-hello","AWS_LAMBDA_FUNCTION_MEMORY_SIZE":"1024","AWS_LAMBDA_FUNCTION_VERSION":"$LATEST","_AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2","_AWS_XRAY_DAEMON_PORT":"2000","AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2:2000","AWS_XRAY_CONTEXT_MISSING":"LOG_ERROR","_X_AMZN_TRACE_ID":"Root=1-5cdcf03a-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0","AWS_EXECUTION_ENV":"AWS_Lambda_nodejs8.10","LUMIGO_IS_WARM":"TRUE"}',
      name: 'w00t',
      type: 'function',
      ended: 895093200000,
      event:
        '{"resource":"/{proxy+}","path":"/hello/world","httpMethod":"POST","headers":{"Accept":"*/*","Accept-Encoding":"gzip, deflate","cache-control":"no-cache","CloudFront-Forwarded-Proto":"https","CloudFront-Is-Desktop-Viewer":"true","CloudFront-Is-Mobile-Viewer":"false","CloudFront-Is-SmartTV-Viewer":"false","CloudFront-Is-Tablet-Viewer":"false","CloudFront-Viewer-Country":"US","Content-Type":"application/json","headerName":"headerValue","Host":"gy415nuibc.execute-api.us-east-1.amazonaws.com","Postman-Token":"9f583ef0-ed83-4a38-aef3-eb9ce3f7a57f","User-Agent":"PostmanRuntime/2.4.5","Via":"1.1 d98420743a69852491bbdea73f7680bd.cloudfront.net (CloudFront)","X-Amz-Cf-Id":"pn-PWIJc6thYnZm5P0NMgOUglL1DYtl0gdeJky8tqsg8iS_sgsKD1A==","X-Forwarded-For":"54.240.196.186, 54.182.214.83","X-Forwarded-Port":"443","X-Forwarded-Proto":"https"},"multiValueHeaders":{"Accept":["*/*"],"Accept-Encoding":["gzip, deflate"],"cache-control":["no-cache"],"CloudFront-Forwarded-Proto":["https"],"CloudFront-Is-Desktop-Viewer":["true"],"CloudFr',
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
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
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
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
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
      return_value: 'data man',
    };
    const handlerReturnValue1 = {
      err: null,
      data: 'data man',
      type: 'async_callbacked',
    };
    MockDate.set(895179612345);
    expect(
      awsSpan.getEndFunctionSpan(functionSpan1, handlerReturnValue1)
    ).toEqual(expectedFunctionSpan1);

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
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      started: 895093200000,
      ended: 895179612345,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'function',
      vendor: 'AWS',
      version: '$LATEST',
      envs: null,
      error: parseErrorObject(err),
      event: null,
      maxFinishTime: 895093323456,
      return_value: null,
    };
    MockDate.set(895179612345);
    expect(
      awsSpan.getEndFunctionSpan(functionSpan1, handlerReturnValue2)
    ).toEqual(expectedFunctionSpan2);
  });

  test('getAwsServiceFromHost', () => {
    const s1 = 'dynamodb';
    const host1 = `${s1}.amazonaws.com`;
    expect(awsSpan.getAwsServiceFromHost(host1)).toEqual(s1);

    const s2 = 'xyz';
    const host2 = `${s2}.cloud.google.com`;
    expect(awsSpan.getAwsServiceFromHost(host2)).toEqual(
      awsSpan.EXTERNAL_SERVICE
    );
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
    expect(awsParsers.dynamodbParser).toHaveBeenCalledWith(
      requestData,
      responseData
    );

    requestData.host = `sns.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.snsParser).toHaveBeenCalledWith(
      requestData,
      responseData
    );

    requestData.host = `lambda.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.lambdaParser).toHaveBeenCalledWith(
      requestData,
      responseData
    );

    requestData.host = `sqs.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.sqsParser).toHaveBeenCalledWith(
      requestData,
      responseData
    );

    requestData.host = `kinesis.amazonaws.com`;

    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.kinesisParser).toHaveBeenCalledWith(
      requestData,
      responseData
    );

    requestData.host = `random.random.execute-api.amazonaws.com`;
    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.apigwParser).toHaveBeenCalledWith(
      requestData,
      responseData
    );

    requestData.host = `deadbeef.amazonaws.com`;
    awsSpan.getAwsServiceData(requestData, responseData);
    expect(awsParsers.awsParser).toHaveBeenCalledWith(
      requestData,
      responseData
    );
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

    const scrubbed_expected = {
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
    expect(awsSpan.getHttpInfo(requestData, responseData)).toEqual(
      scrubbed_expected
    );
  });

  test('getBasicHttpSpan', () => {
    const id = 'not-a-random-id';
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
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id,
      type: 'http',
      parentId: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
    };
    expect(awsSpan.getBasicHttpSpan(id)).toEqual(expected);

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
      transactionId: '64a1b06067c2100c52e51ef4',
      account: '985323015126',
      memoryAllocated: '1024',
      version: '$LATEST',
      runtime: 'AWS_Lambda_nodejs8.10',
      readiness: 'warm',
      messageVersion: 2,
      token: 'DEADBEEF',
      region: 'us-east-1',
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      id: spanId,
      type: 'http',
      parentId: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
    };
    expect(awsSpan.getBasicHttpSpan(spanId)).toEqual(expected2);
  });

  test('getHttpSpan ', () => {
    const id = 'not-a-random-id';
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
      parentId: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      service: 'external',
      started: 1234,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'http',
      vendor: 'AWS',
      version: '$LATEST',
    };

    const result = awsSpan.getHttpSpan(id, requestData, responseData);
    expect(result).toEqual(expected);
  });

  test('getHttpSpan - only for request data', () => {
    const id = 'not-a-random-id';
    const sendTime = 1234;

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
      parentId: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      service: 'external',
      started: 1234,
      token: 'DEADBEEF',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'http',
      vendor: 'AWS',
      version: '$LATEST',
    };

    const result = awsSpan.getHttpSpan(id, requestData);
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

    const result = awsSpan.getHttpSpan(id, requestData);
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
    const expected = { reporter_rtt: rtt, ...functionSpan };
    expect(awsSpan.addRttToFunctionSpan(functionSpan, rtt)).toEqual(expected);
  });
});
