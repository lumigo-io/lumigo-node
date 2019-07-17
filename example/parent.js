const axios = require('axios');
const token = 't_a595aa58c126575c5c41';
const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
const debug = true;

const lumigo = require('./lumigo')({ token, edgeHost, debug });

//const LumigoTracer = require('@lumigo/tracer');
//const RellyTracer = new LumigoTracer({ token, host: edgeHost });

const parentFn = async (event, context, callback) => {
  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });
  const lambda = new AWS.Lambda();
  const x = await lambda
    .invoke({ FunctionName: 'aws-nodejs-dev-child' })
    .promise();
  console.log(x);
  return '123';
};

//exports.handler = RellyTracer.trace(parentFn);
exports.handler = lumigo.trace(parentFn);
