/* eslint-disable */
const lambdaLocal = require('lambda-local');
const crypto = require('crypto');
const exampleApiGatewayEvent = require('./src/testdata/events/apigw-request.json');
const https = require('https');
const http = require('http');
const fetch = require('node-fetch');

// XXX Below are real E2E system tests.
describe.skip('end-to-end lumigo-node', () => {
  const oldEnv = Object.assign({}, process.env);
  const verboseLevel = 0; // XXX 0 - supressed lambdaLocal outputs, 3 - logs are outputted.

  let clientContext = {};
  let environment = {};
  let token = '';

  beforeEach(() => {
    token = 't_a595aa58c126575c5c41';
    environment = getRandomAwsEnv();
    clientContext = JSON.stringify(getRandomClientContext());

    const { HOME } = oldEnv;
    process.env = { HOME, ...environment };
  });

  afterEach(() => {
    process.env = { ...oldEnv };
  });

  test('real: async rejected', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost, switchOff });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = async (event, context, callback) => {
      const AWS = require('aws-sdk');
      AWS.config.update({ region: 'us-west-2' });
      const ddb = new AWS.DynamoDB();
      const params = {
        TableName: 'sagid_common-resources_spans',
        Key: {
          span_id: { S: '6fa4d7ea-93e2-75c1-d75f-b276375c7cc7' },
          span_type: { S: 'function' },
        },
      };

      const data = await ddb.getItem(params).promise();
      throw new Error(expectedReturnValue);
    };

    const callback = function(err, data) {
      expect(err.errorMessage).toEqual(expectedReturnValue);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      environment,
      verboseLevel,
      clientContext,
      callback,
    });
  });

  test('real: async resolved', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost, switchOff });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = async (event, context, callback) => {
      const AWS = require('aws-sdk');
      AWS.config.update({ region: 'us-west-2' });
      const ddb = new AWS.DynamoDB();
      const params = {
        TableName: 'sagid_common-resources_spans',
        Key: {
          span_id: { S: '6fa4d7ea-93e2-75c1-d75f-b276375c7cc7' },
          span_type: { S: 'function' },
        },
      };

      const data = await ddb.getItem(params).promise();
      return expectedReturnValue;
    };

    const callback = function(err, data) {
      expect(data).toEqual(expectedReturnValue);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });

  test('real: async callback', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost, switchOff });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = async (event, context, callback) => {
      const AWS = require('aws-sdk');
      AWS.config.update({ region: 'us-west-2' });
      const ddb = new AWS.DynamoDB();
      const params = {
        TableName: 'sagid_common-resources_spans',
        Key: {
          span_id: { S: '6fa4d7ea-93e2-75c1-d75f-b276375c7cc7' },
          span_type: { S: 'function' },
        },
      };

      const data = await ddb.getItem(params).promise();
      callback(null, expectedReturnValue);
    };

    const callback = function(err, data) {
      expect(data).toEqual(expectedReturnValue);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });

  test('real: non async callback', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost, switchOff });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = (event, context, callback) => {
      const AWS = require('aws-sdk');
      AWS.config.update({ region: 'us-west-2' });
      const ddb = new AWS.DynamoDB();
      const params = {
        TableName: 'sagid_common-resources_spans',
        Key: {
          span_id: { S: '6fa4d7ea-93e2-75c1-d75f-b276375c7cc7' },
          span_type: { S: 'function' },
        },
      };

      ddb.getItem(params, (err, data) => {
        callback(null, expectedReturnValue);
      });
    };

    const callback = function(err, data) {
      expect(data).toEqual(expectedReturnValue);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });

  test('real: non async error thrown', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    // XXX Trying out the old way of instantiating the tracer.
    const LumigoTracer = require('./');
    const tracer = new LumigoTracer({ token, edgeHost });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = (event, context, callback) => {
      throw new Error(expectedReturnValue);
    };

    const callback = function(err, data) {
      expect(err.errorMessage).toEqual(expectedReturnValue);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: tracer.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });

  test('real: Node.js 10.x https.request(url...)', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = (event, context, callback) => {
      const req = https.request('https://example.org', res => {
        const { statusCode } = res;
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => callback(null, { statusCode, data }));
      });
      req.end();
    };

    const callback = function(err, data) {
      expect(data.statusCode).toEqual(200);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });

  test('real: Node.js 10.x https.get(url, cb)', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = (event, context, callback) => {
      const req = https.get('https://sagi.io', res => {
        const { statusCode } = res;
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => callback(null, { statusCode, data }));
      });
      req.end();
    };

    const callback = function(err, data) {
      expect(data.statusCode).toEqual(200);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });

  test('real: Node.js 10.x https.get(url)', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost, debug: false });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = (event, context, callback) => {
      const req = https.get('https://example.org');

      req.on('response', res => {
        const { statusCode } = res;
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => callback(null, { statusCode, data }));
      });
      req.end();
    };

    const callback = function(err, data) {
      expect(data.statusCode).toEqual(200);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });

  test('real: node-fetch', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./')({ token, edgeHost });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = async (event, context, callback) => {
      const response = await fetch('https://sagi.io');
      const { status } = response;
      const data = await response.text();
      callback(null, { status, data });
    };

    const callback = function(err, data) {
      expect(data.status).toEqual(200);
      done();
    };

    lambdaLocal.execute({
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      event: exampleApiGatewayEvent,
      timeoutMs: 30000,
      clientContext,
      verboseLevel,
      environment,
      callback,
    });
  });
});

const getRandomString = evenNrChars =>
  crypto
    .randomBytes(evenNrChars / 2)
    .toString('hex')
    .toLowerCase();

const getRandomAwsEnv = () => {
  const transactionId = getRandomString(10);
  return {
    LAMBDA_TASK_ROOT: '/var/task',
    LAMBDA_RUNTIME_DIR: '/var/runtime',
    AWS_REGION: 'us-east-1',
    AWS_DEFAULT_REGION: 'us-east-1',
    AWS_LAMBDA_LOG_GROUP_NAME: '/aws/lambda/aws-nodejs-dev-hello',
    AWS_LAMBDA_LOG_STREAM_NAME:
      '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
    AWS_LAMBDA_FUNCTION_NAME: 'RANDOM_LAMBDA_LOCAL_ENV',
    AWS_LAMBDA_FUNCTION_MEMORY_SIZE: '1024',
    AWS_LAMBDA_FUNCTION_VERSION: '$LATEST',
    _AWS_XRAY_DAEMON_ADDRESS: '169.254.79.2',
    _AWS_XRAY_DAEMON_PORT: '2000',
    AWS_XRAY_DAEMON_ADDRESS: '169.254.79.2:2000',
    AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
    _X_AMZN_TRACE_ID: `Root=1-5cdcf03a-${transactionId};Parent=28effe37598bb622;Sampled=0`,
    AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs8.10',
    //LUMIGO_DEBUG: 'TRUE',
  };
};

const getRandomClientContext = () => {
  const x1 = getRandomString(8);
  const x5 = getRandomString(12);
  const awsRequestId = `${x1}-60a6-4cee-8a70-${x5}`;
  const functionName = 'w00t';
  const remainingTimeInMillis = 123456;
  const getRemainingTimeInMillis = () => remainingTimeInMillis;
  const awsAccountId = `985323015126`;
  const invokedFunctionArn = `arn:aws:lambda:us-east-1:${awsAccountId}:function:aws-nodejs-dev-hello`;

  return {
    awsRequestId,
    functionName,
    invokedFunctionArn,
    getRemainingTimeInMillis,
  };
};
