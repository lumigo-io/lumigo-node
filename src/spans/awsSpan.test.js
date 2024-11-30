import MockDate from 'mockdate';
import { encode } from 'utf8';
import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { MAX_TRACER_ADDED_DURATION_ALLOWED, TracerGlobals } from '../globals';
import * as awsParsers from '../parsers/aws';
import * as utils from '../utils';
import {
  EXECUTION_TAGS_KEY,
  getEventEntitySize,
  LUMIGO_SECRET_MASKING_ALL_MAGIC,
  LUMIGO_SECRET_MASKING_EXACT_PATH,
  LUMIGO_SECRET_MASKING_REGEX_ENVIRONMENT,
  LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES,
  LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_HEADERS,
  LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES,
  LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_HEADERS,
  parseErrorObject,
} from '../utils';
import { payloadStringify } from '../utils/payloadStringify';
import * as awsSpan from './awsSpan';
import {
  decodeHttpBody,
  ENRICHMENT_SPAN,
  FUNCTION_SPAN,
  getSpanMetadata,
  HTTP_SPAN,
  MSSQL_SPAN,
  MYSQL_SPAN,
  NEO4J_SPAN,
  PG_SPAN,
  spansPrioritySorter,
} from './awsSpan';
import { addW3CTracePropagator } from '../utils/w3cUtils';
import { SqlSpanBuilder } from '../../testUtils/sqlSpanBuilder';
import { MongoSpanBuilder } from '../../testUtils/mongoSpanBuilder';
import { RedisSpanBuilder } from '../../testUtils/redisSpanBuilder';
import { PrismaSpanBuilder } from '../../testUtils/prismaSpanBuilder';

const exampleApiGatewayEvent = require('../../testUtils/testdata/events/apigw-request.json');
const clone = require('rfdc')();

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
      id: 'id',
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

    expect(awsSpan.getBasicSpan('id', '64a1b06067c2100c52e51ef4')).toEqual(expectedBasicSpan);
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
        tracer: {
          name: '@lumigo/tracerMock',
          version: '1.2.3',
        },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        trigger: [],
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
      envs: '{"LAMBDA_TASK_ROOT":"/var/task","LAMBDA_RUNTIME_DIR":"/var/runtime","AWS_REGION":"us-east-1","AWS_DEFAULT_REGION":"us-east-1","AWS_LAMBDA_LOG_GROUP_NAME":"/aws/lambda/aws-nodejs-dev-hello","AWS_LAMBDA_LOG_STREAM_NAME":"2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73","AWS_LAMBDA_FUNCTION_NAME":"aws-nodejs-dev-hello","AWS_LAMBDA_FUNCTION_MEMORY_SIZE":"1024","AWS_LAMBDA_FUNCTION_VERSION":"$LATEST","_AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2","_AWS_XRAY_DAEMON_PORT":"2000","AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2:2000","AWS_XRAY_CONTEXT_MISSING":"LOG_ERROR","_X_AMZN_TRACE_ID":"Root=1-5cdcf03a-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0","AWS_EXECUTION_ENV":"AWS_Lambda_nodejs8.10","LUMIGO_IS_WARM":"TRUE"}',
      name: 'aws-nodejs-dev-hello',
      type: 'function',
      ended: 895093200000,
      event:
        '{"resource":"/{proxy+}","path":"/hello/world","httpMethod":"POST","headers":{"Accept":"*/*","Accept-Encoding":"gzip, deflate","cache-control":"no-cache","CloudFront-Forwarded-Proto":"https","CloudFront-Is-Desktop-Viewer":"true","CloudFront-Is-Mobile-Viewer":"false","CloudFront-Is-SmartTV-Viewer":"false","CloudFront-Is-Tablet-Viewer":"false","CloudFront-Viewer-Country":"US","Content-Type":"application/json","headerName":"headerValue","Host":"gy415nuibc.execute-api.us-east-1.amazonaws.com","Postman-Token":"9f583ef0-ed83-4a38-aef3-eb9ce3f7a57f","User-Agent":"PostmanRuntime/2.4.5","Via":"1.1 d98420743a69852491bbdea73f7680bd.cloudfront.net (CloudFront)","X-Amz-Cf-Id":"pn-PWIJc6thYnZm5P0NMgOUglL1DYtl0gdeJky8tqsg8iS_sgsKD1A==","X-Forwarded-For":"54.240.196.186, 54.182.214.83","X-Forwarded-Port":"443","X-Forwarded-Proto":"https"},"multiValueHeaders":{"Accept":["*/*"],"Accept-Encoding":["gzip, deflate"],"cache-control":["no-cache"],"CloudFront-Forwarded-Proto":["https"],"CloudFront-Is-Desktop-Viewer":["true"],"CloudFront-Is-Mobile-Viewer":["false"],"CloudFront-Is-SmartTV-Viewer":["false"],"CloudFront-Is-Tablet-Viewer":["false"],"CloudFront-Viewer-Country":["US"],"Content-Type":["application/json"],"headerName":["headerValue"],"Host":["gy415nuibc.execute-api.us-east-1.amazonaws.com"],"Postman-Token":["9f583ef0-ed83-4a38-aef3-eb9ce3f7a57f"],"User-Agent":["PostmanRuntime/2.4.5"],"Via":["1.1 d98420743a69852491bbdea73f7680bd.cloudfront.net (CloudFront)"],"X-Amz-Cf-Id":["pn-PWIJc6thYnZm5P0NMgOUglL1DYtl0gdeJky8tqsg8iS_sgsKD1A=="],"X-Forwarded-For":["54.240.196.186, 54.182.214.83"],"X-Forwarded-Port":["443"],"X-Forwarded-Proto":["https"]},"queryStringParameters":{"name":"me"},"multiValueQueryStringParameters":{"name":["me"]},"pathParameters":{"proxy":"hello/world"},"stageVariables":{"stageVariableName":"stageVariableValue"},"requestContext":{"accountId":"12345678912","resourceId":"roq9wj","stage":"testStage","requestId":"deef4878-7910-11e6-8f14-25afc3e9ae33","identity":{"cognitoIdentityPoolId":"theCognitoIdentityPoolId","accountId":"theAccountId","cognitoIdentityId":"theCognitoIdentityId","caller":"theCaller","apiKey":"****","accessKey":"****","sourceIp":"192.168.196.186","cognitoAuthenticationType":"theCognitoAuthenticationType","cognitoAuthenticationProvider":"theCognitoAuthenticationProvider","userArn":"theUserArn","userAgent":"PostmanRuntime/2.4.5","user":"theUser"},"authorizer":{"principalId":"admin","clientId":1,"clientName":"Exata"},"resourcePath":"/{proxy+}","httpMethod":"POST","apiId":"gy415nuibc"},"body":"{\\r\\n\\t\\"a\\": 1\\r\\n}"}',
      started: 895093200000,
      maxFinishTime: 895093210000,
    };
    const { event, context } = new HandlerInputsBuilder().build();
    expect(awsSpan.getFunctionSpan(event, context)).toEqual(expectedStartSpan);
  });

  test('getFunctionSpan', () => {
    const { event, context } = TracerGlobals.getHandlerInputs();
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
        trigger: [
          {
            fromMessageIds: ['deef4878-7910-11e6-8f14-25afc3e9ae33'],
            extra: {
              httpMethod: 'POST',
              resource: '/{proxy+}',
              stage: 'testStage',
              api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
            },
            triggeredBy: 'apigw',
            targetId: null,
          },
        ],
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
    const actualSpan = awsSpan.getFunctionSpan(event, context);
    delete actualSpan.info.trigger[0].id;
    expect(actualSpan).toEqual(expectedStartSpan);
  });

  test('removeStartedFromId', () => {
    const idWithStarted = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started';
    expect(awsSpan.removeStartedFromId(idWithStarted)).toEqual(
      '6d26e3c8-60a6-4cee-8a70-f525f47a4caf'
    );
  });

  test('getEnvsForSpan', () => {
    process.env[LUMIGO_SECRET_MASKING_REGEX_ENVIRONMENT] = '["DONT_TELL"]';
    process.env.DONT_TELL = '1234';
    expect(JSON.parse(awsSpan.getEnvsForSpan()).DONT_TELL).toEqual('****');
  });

  test('getEndFunctionSpan', () => {
    const event = { a: 'b', c: 'd' };
    TracerGlobals.setHandlerInputs({
      event,
      context: {
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
      },
    });

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
    const startSpan = awsSpan.getFunctionSpan(event, context);

    const endSpan = awsSpan.getEndFunctionSpan(startSpan, handlerReturnValue);

    expect(endSpan.event).not.toEqual(payloadStringify(event));
    expect(endSpan.event).toEqual(payloadStringify(event, getEventEntitySize() * 2));
    expect(endSpan.event.length).toBeGreaterThan(startSpan.event.length);
    expect(endSpan.envs).not.toEqual(payloadStringify(envs));
    expect(endSpan.envs).toEqual(payloadStringify(envs, getEventEntitySize() * 2));
    expect(endSpan.envs.length).toBeGreaterThan(startSpan.envs.length);
  });

  test('getEndFunctionSpan does not modify returnValue payload', () => {
    const functionSpan = {
      id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started',
    };

    const handlerReturnValue = {
      err: null,
      data: {
        string: 'value',
        object: {
          string: 'value',
          object: {
            string: 'value',
          },
        },
      },
    };
    const expectedData = clone(handlerReturnValue.data);

    process.env[LUMIGO_SECRET_MASKING_EXACT_PATH] =
      '["string","object.string", "object.object.string"]';

    const endFunctionSpan = awsSpan.getEndFunctionSpan(functionSpan, handlerReturnValue);
    expect(endFunctionSpan.return_value).toEqual(
      '{"string":"****","object":{"string":"****","object":{"string":"****"}}}'
    );
    expect(handlerReturnValue.data).toEqual(expectedData);
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
    const startSpan = awsSpan.getFunctionSpan(event, context);
    expect(JSON.parse(startSpan.event).Records[0].s3.object.key).toEqual('value');
  });

  test('Lambda invoked by Lambda -> shouldnt scrub initial event', () => {
    const { context } = TracerGlobals.getHandlerInputs();
    const event = {
      string: 'value',
      object: {
        string: 'value',
        object: {
          string: 'value',
        },
      },
    };
    process.env[LUMIGO_SECRET_MASKING_EXACT_PATH] =
      '["string","object.string", "object.object.string"]';
    TracerGlobals.setHandlerInputs({ event, context });
    const startSpan = awsSpan.getFunctionSpan(event, context);

    expect(event.string).toEqual('value');
    expect(event.object.string).toEqual('value');
    expect(event.object.object.string).toEqual('value');
    expect(JSON.parse(startSpan.event).string).toEqual('****');
    expect(JSON.parse(startSpan.event).object.object.string).toEqual('****');
  });

  test('Lambda invoked by DDB stream -> shouldnt scrub known fields', () => {
    const { context } = TracerGlobals.getHandlerInputs();
    const event = {
      Records: [
        {
          eventID: '22222222222222222222222222222222',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-west-2',
          dynamodb: {
            ApproximateCreationDateTime: 1613303796,
            Keys: { k: { S: 'k1' } },
            NewImage: { v: { S: 'v1' }, k: { S: 'k1' } },
            SequenceNumber: '111111111111111111111111111',
            SizeBytes: 9,
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
          eventSourceARN:
            'arn:aws:dynamodb:us-west-2:111111111111:table/table-with-stream/stream/2020-08-25T09:03:34.483',
        },
        {
          eventID: '22222222222222222222222222222223',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-west-2',
          dynamodb: {
            ApproximateCreationDateTime: 1613303796,
            Keys: { k: { S: 'k2' } },
            NewImage: { v: { S: 'v2' }, k: { S: 'k2' } },
            SequenceNumber: '111111111111111111111111112',
            SizeBytes: 9,
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
          eventSourceARN:
            'arn:aws:dynamodb:us-west-2:111111111111:table/table-with-stream/stream/2020-08-25T09:03:34.483',
        },
      ],
    };
    TracerGlobals.setHandlerInputs({ event, context });
    const startSpan = awsSpan.getFunctionSpan(event, context);
    expect(JSON.parse(startSpan.event).Records[0].dynamodb.Keys).toEqual({ k: { S: 'k1' } });
    expect(JSON.parse(startSpan.event).Records[1].dynamodb.Keys).toEqual({ k: { S: 'k2' } });
  });

  test('getEndFunctionSpan without error and big event and envs should have same data than startSpan', () => {
    const longString = 'a'.repeat(getEventEntitySize() * 3);
    let { event, context } = TracerGlobals.getHandlerInputs();
    event = { ...event, longString };
    TracerGlobals.setHandlerInputs({ event, context });
    const envs = { ...process.env, longString };
    process.env = envs;
    const handlerReturnValue = { err: null, data: undefined, type: 'async_callbacked' };
    const startSpan = awsSpan.getFunctionSpan(event, context);

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
    const requestData = { a: 'b', headers: {} };
    const responseData = { d: 'd', headers: {} };
    requestData.host = `dynamodb.amazonaws.com`;

    jest.spyOn(awsParsers, 'dynamodbParser');
    awsSpan.getServiceData(requestData, responseData);
    expect(awsParsers.dynamodbParser).toHaveBeenCalledWith(requestData);

    requestData.host = `sns.amazonaws.com`;

    jest.spyOn(awsParsers, 'snsParser');
    awsSpan.getServiceData(requestData, responseData);
    expect(awsParsers.snsParser).toHaveBeenCalledWith(requestData, responseData);

    jest.spyOn(awsParsers, 'lambdaParser');
    const lambdaRequest = { a: 'b', headers: {}, host: `lambda.amazonaws.com`, path: '///' };
    awsSpan.getServiceData(lambdaRequest, responseData);
    expect(awsParsers.lambdaParser).toHaveBeenCalledWith(lambdaRequest, responseData);

    requestData.host = `sqs.amazonaws.com`;

    jest.spyOn(awsParsers, 'sqsParser');
    awsSpan.getServiceData(requestData, responseData);
    expect(awsParsers.sqsParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `kinesis.amazonaws.com`;

    jest.spyOn(awsParsers, 'kinesisParser');
    awsSpan.getServiceData(requestData, responseData);
    expect(awsParsers.kinesisParser).toHaveBeenCalledWith(requestData, responseData);

    requestData.host = `events.us-west-2.amazonaws.com`;

    jest.spyOn(awsParsers, 'eventBridgeParser');
    awsSpan.getServiceData(requestData, responseData);
    expect(awsParsers.eventBridgeParser).toHaveBeenCalledWith(requestData, responseData);

    jest.spyOn(awsParsers, 'apigwParser');
    requestData.host = `random.random.execute-api.amazonaws.com`;
    awsSpan.getServiceData(requestData, responseData);
    expect(awsParsers.apigwParser).toHaveBeenCalledWith(requestData, responseData);

    jest.spyOn(awsParsers, 'defaultParser');
    requestData.host = `deadbeef.amazonaws.com`;
    awsSpan.getServiceData(requestData, responseData);
    expect(awsParsers.defaultParser).toHaveBeenCalledWith(requestData, responseData);
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
      truncated: false,
      sendTime,
    };
    const responseData = {
      headers: { Peter: 'Parker' },
      body: 'Well, Tony is dead.',
      statusCode: 200,
      truncated: false,
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
            truncated: false,
            body: 'the first rule of fight club',
            headers: { Tyler: 'Durden' },
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {
            truncated: false,
            body: 'Well, Tony is dead.',
            headers: { Peter: 'Parker' },
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
            body: 'the first rule of fight club',
            headers: { Tyler: 'Durden' },
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {
            truncated: false,
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
            body: 'the first rule of fight club',
            headers: { Tyler: 'Durden' },
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {
            truncated: false,
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

  test('getHttpSpan - secret masking different fields', () => {
    process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES] = LUMIGO_SECRET_MASKING_ALL_MAGIC;
    process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_HEADERS] = '["X"]';
    process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES] = LUMIGO_SECRET_MASKING_ALL_MAGIC;

    const testData = {
      requestData: {
        a: 'request',
        sendTime: 1,
        truncated: false,
        host: 'your.mind.com',
        headers: { host: 'your.mind.com', password: '1234' },
        body: 'bla',
      },
      responseData: {
        truncated: false,
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A' },
        body: 'start',
      },
    };

    const result = awsSpan.getHttpSpan(
      '123',
      '',
      '123',
      testData.requestData,
      testData.responseData
    );
    expect(result.info.httpInfo.request.body).toEqual('****');
    // Check that the request headers will get the default masking
    expect(result.info.httpInfo.request.headers).toEqual({
      host: 'your.mind.com',
      password: '****',
    });
    expect(result.info.httpInfo.response.body).toEqual('****');
    expect(result.info.httpInfo.response.headers).toEqual({ X: '****', z: 'A' });
  });

  test('getHttpSpan - secret masking malformed regex get default', () => {
    process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_HEADERS] = '["X';

    const testData = {
      requestData: {
        a: 'request',
        sendTime: 1,
        truncated: false,
        host: 'your.mind.com',
        headers: { host: 'your.mind.com', password: '1234' },
        body: 'bla',
      },
    };

    const result = awsSpan.getHttpSpan('123', '', '123', testData.requestData);
    expect(result.info.httpInfo.request.headers).toEqual({
      host: 'your.mind.com',
      password: '****',
    });
  });

  test('getHttpSpan - adds messageId for non-aws call when LUMIGO_PROPAGATE_W3C is present', () => {
    let headers = { host: 'your.mind.com', password: '1234' };
    addW3CTracePropagator(headers);

    const testData = {
      requestData: {
        a: 'request',
        sendTime: 1,
        truncated: false,
        host: 'your.mind.com',
        headers: headers,
        body: 'bla',
      },
    };
    const result = awsSpan.getHttpSpan('123', '', '123', testData.requestData);
    expect(result.info.messageId).not.toBeUndefined();
  });

  test('getHttpSpan - override w3c messageId if this is an API gateway', () => {
    let requestHeaders = { host: 'your.mind.com', password: '1234' };
    addW3CTracePropagator(requestHeaders);

    const testData = {
      requestData: {
        a: 'request',
        sendTime: 1,
        truncated: false,
        host: 'blabla.execute-api.amazonaws.com',
        headers: requestHeaders,
        body: 'bla',
      },
      responseData: {
        truncated: false,
        headers: { 'apigw-requestid': 'apigw-requestid' },
      },
    };
    const result = awsSpan.getHttpSpan(
      '123',
      '',
      '123',
      testData.requestData,
      testData.responseData
    );
    expect(result.info.messageId).toEqual('apigw-requestid');
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

  test('decodeHttpBody => simple flow', () => {
    const httpBody = encode('Bla Bla Body');

    const result = decodeHttpBody(httpBody, false);

    expect(result).toEqual('Bla Bla Body');
  });

  test('decodeHttpBody => not utf-8', () => {
    const httpBody = 'Bla Bla Body';

    const result = decodeHttpBody(httpBody, false);

    expect(result).toEqual('Bla Bla Body');
  });

  test('decodeHttpBody => not string', () => {
    const httpBody = { text: 'Bla Bla Body' };

    const result = decodeHttpBody(httpBody, false);

    expect(result).toEqual({ text: 'Bla Bla Body' });
  });

  test('decodeHttpBody => entity to big (not decoding)', () => {
    const body = 'B'.repeat(getEventEntitySize() + 100);
    const httpBody = encode(body);

    const result = decodeHttpBody(httpBody, false);

    expect(result).toEqual(httpBody);
  });

  test('decodeHttpBody => error => entity to big (decoding)', () => {
    const body = 'B'.repeat(getEventEntitySize() + 100);
    const httpBody = encode(body);

    const result = decodeHttpBody(httpBody, true);

    expect(result).toEqual(body);
  });

  test.each`
    input                                                                                        | expectedOutput
    ${[{ type: HTTP_SPAN, error: 'error' }, { type: FUNCTION_SPAN }, { type: ENRICHMENT_SPAN }]} | ${[{ type: FUNCTION_SPAN }, { type: ENRICHMENT_SPAN }, { type: HTTP_SPAN, error: 'error' }]}
    ${[{ type: HTTP_SPAN }, { type: HTTP_SPAN, error: 'error' }, { type: FUNCTION_SPAN }]}       | ${[{ type: FUNCTION_SPAN }, { type: HTTP_SPAN, error: 'error' }, { type: HTTP_SPAN }]}
    ${[{ type: HTTP_SPAN }, { type: 'unknown' }, { type: FUNCTION_SPAN }]}                       | ${[{ type: FUNCTION_SPAN }, { type: HTTP_SPAN }, { type: 'unknown' }]}
  `('test spansPrioritySorter', ({ input, expectedOutput }) => {
    input.sort(spansPrioritySorter);
    expect(input).toEqual(expectedOutput);
  });

  test.each`
    input                                                                                                  | expectedOutput
    ${{ end: 'dummyEnd', type: FUNCTION_SPAN, envs: { firstEnvKey: 'First environment variable value' } }} | ${{ end: 'dummyEnd', type: FUNCTION_SPAN, isMetadata: true }}
    ${{ end: 'dummyEnd', type: ENRICHMENT_SPAN }}                                                          | ${{ end: 'dummyEnd', type: ENRICHMENT_SPAN, isMetadata: true }}
    ${{ end: 'dummyEnd', type: ENRICHMENT_SPAN, [EXECUTION_TAGS_KEY]: ['tag1', 'tag2'] }}                  | ${{ end: 'dummyEnd', type: ENRICHMENT_SPAN, isMetadata: true }}
  `('test getSpanMetadata', ({ input, expectedOutput }) => {
    const result = getSpanMetadata(input);

    expect(result).toEqual(expectedOutput);
  });

  test('test getSpanMetadata with http span', () => {
    const httpSpan = {
      dummy: 'dummy',
      type: HTTP_SPAN,
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              body: 'aaaaaaaa',
            }),
          },
          response: {
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              longBodyKey: 'body with very long value that we think we need to cut in the middle',
            }),
          },
        },
      },
    };
    const httpSpanMetadata = {
      dummy: 'dummy',
      type: HTTP_SPAN,
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
          },
          response: {},
        },
      },
      isMetadata: true,
    };

    const result = getSpanMetadata(httpSpan);

    expect(result).toEqual(httpSpanMetadata);
  });

  test.each([PG_SPAN, MSSQL_SPAN, MYSQL_SPAN, NEO4J_SPAN])(
    'test getSpanMetadata with sql span',
    (spanType) => {
      const dummyRow = { name: 'LumigoDevMan', dummyNumber: 6 };
      const sqlSpan = new SqlSpanBuilder()
        .withType(spanType)
        .withQuery('SELECT * from users')
        .withValues(payloadStringify(['123']))
        .withResponse({ rowCount: 1, rows: payloadStringify(dummyRow) })
        .build();
      const sqlSpanMetadata = new SqlSpanBuilder()
        .withType(spanType)
        .withQuery('SELECT * from users')
        .withValues(payloadStringify(['123']))
        .withResponse({ rowCount: 1, rows: payloadStringify(dummyRow) })
        .onlyMetadata()
        .build();

      const result = getSpanMetadata(sqlSpan);

      expect(result).toEqual(sqlSpanMetadata);
    }
  );

  test('test getSpanMetadata with mongo span', () => {
    const mongoSpan = new MongoSpanBuilder()
      .withRequest(
        '{"insert":"documents","documents":[{"a":1},{"a":2},{"a":3}],"ordered":true,"lsid":{"id":"2"},"txnNumber":1,"$clusterTime":{"clusterTime":123,"signature":"****"},"$db":"TracerDB"}'
      )
      .withResponse(
        '{"n":1,"opTime":{"ts":123456,"t":3},"electionId":7,"ok":1,"$clusterTime":{"clusterTime":123456,"signature":"****"},"operationTime":12345}'
      )
      .withDatabaseName('TracerDB')
      .withCommandName('insert')
      .build();

    const mongoSpanMetadata = new MongoSpanBuilder()
      .withRequest(
        '{"insert":"documents","documents":[{"a":1},{"a":2},{"a":3}],"ordered":true,"lsid":{"id":"2"},"txnNumber":1,"$clusterTime":{"clusterTime":123,"signature":"****"},"$db":"TracerDB"}'
      )
      .withResponse(
        '{"n":1,"opTime":{"ts":123456,"t":3},"electionId":7,"ok":1,"$clusterTime":{"clusterTime":123456,"signature":"****"},"operationTime":12345}'
      )
      .withDatabaseName('TracerDB')
      .withCommandName('insert')
      .onlyMetadata()
      .build();

    const result = getSpanMetadata(mongoSpan);

    expect(result).toEqual(mongoSpanMetadata);
  });

  test('test getSpanMetadata with redis span', () => {
    const dummyConnectionOptions = {
      host: 'tracer-test-cluster.1meza6.ng.0001.usw1.cache.amazonaws.com',
      port: '6379',
    };
    const redisSpan = new RedisSpanBuilder()
      .withConnectionOptions(dummyConnectionOptions)
      .withRequestCommand('set')
      .withRequestArgs('["Key","Value"]')
      .withResponse(`"OK"`)
      .build();

    const redisSpanMetadata = new RedisSpanBuilder()
      .withConnectionOptions(dummyConnectionOptions)
      .withRequestCommand('set')
      .withRequestArgs('["Key","Value"]')
      .withResponse(`"OK"`)
      .onlyMetadata()
      .build();

    const result = getSpanMetadata(redisSpan);

    expect(result).toEqual(redisSpanMetadata);
  });

  test('test getSpanMetadata with prisma span', () => {
    const prismaSpan = new PrismaSpanBuilder()
      .withModel('User')
      .withOperation('count')
      .withQueryArgs('{"where":{"id":123456}}')
      .withResult('0')
      .build();

    const prismaSpanMetadata = new PrismaSpanBuilder()
      .withModel('User')
      .withOperation('count')
      .withQueryArgs('{"where":{"id":123456}}')
      .withResult('0')
      .onlyMetadata()
      .build();

    const result = getSpanMetadata(prismaSpan);

    expect(result).toEqual(prismaSpanMetadata);
  });
});
