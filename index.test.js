const lambdaLocal = require('lambda-local');
const axios = require('axios');
const crypto = require('crypto');

const exampleApiGatewayEvent = require('./src/testdata/events/apigw-request.json');

describe('lumigo-node', () => {
  const oldEnv = Object.assign({}, process.env);
  let awsEnv = {};
  let token = '';

  beforeEach(() => {
    token = 't_a595aa58c126575c5c41';
    awsEnv = getRandomAwsEnv();
    const { HOME } = oldEnv;
    process.env = { HOME, ...awsEnv };
  });

  afterEach(() => {
    process.env = { ...oldEnv };
  });

  test('x', async () => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';

    const switchOff = false;
    const lumigo = require('./index')({ token, edgeHost, switchOff });
    const expectedReturnValue = 'Satoshi was here';

    const userHandler = async (event, context, callback) => {
      // XXX Test the case for an NX Domain

      //const x = await axios.get('https://sagi.io/');

      throw new Error('blechsssa');
      //callback(null, 'baba');
      //console.log(x);
      return expectedReturnValue;
    };

    const returnValue = await lambdaLocal.execute({
      event: exampleApiGatewayEvent,
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      timeoutMs: 15000,
      environment: awsEnv,
      verboseLevel: 3,
    });

    expect(returnValue).toEqual(expectedReturnValue);
  });

  test.only('y', done => {
    jest.setTimeout(30000);
    const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
    const switchOff = false;
    const lumigo = require('./index')({ token, edgeHost, switchOff });
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
      if (err) {
        console.log(err);
        done();
      } else {
        console.log(data);
        done();
      }
    };
    lambdaLocal.execute({
      event: exampleApiGatewayEvent,
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      timeoutMs: 30000,
      environment: awsEnv,
      verboseLevel: 3,
      callback,
    });
  });
});

const getRandomString = evenNrChars =>
  crypto.randomBytes(evenNrChars / 2).toString('hex');

const getRandomAwsEnv = () => {
  const transactionId = getRandomString(10);
  // XXX Add parentId / id mocks (contexts...)
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
  };
};

/*
  return Promise.all([pStartTrace, pUserHandler]).then(
    ([functionSpan, handlerReturnValue]) => {
      console.log(handlerReturnValue);
      endTrace(functionSpan, handlerReturnValue).then(
        callback(null, handlerReturnValue)
      );
    }
  );


*/
