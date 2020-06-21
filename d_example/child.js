const token = 't_867e2f98aac949d989da1';
const edgeHost = 'tracer-edge.internal-monitoring.golumigo.com';
const debug = true;
const lumigo = require('@lumigo/tracer')({ token, edgeHost, debug });
const beeceptorUrl = 'https://test-tracer-1.free.beeceptor.com';

const gotRequest = async () => {
  const got = require('got');
  return await got.post(beeceptorUrl, {
    json: {
      hello: 'world',
    },
    headers: {
      'x-unicorn': 'rainbow',
    },
    responseType: 'json',
  });
};

const nidleeRequest = async () => {
  const needle = require('needle');
  const requestData = { lumigo: '1234' };
  const headers = { lumigoHeader: '4321' };
  await needle.get(`${beeceptorUrl}/hello?lumigo=1234`, { headers: headers });
  await needle.post(`${beeceptorUrl}/world`, requestData, { headers: headers });
  return await needle;
};

const dynamoDbRequests = async () => {
  const AWS = require('aws-sdk');
  const dynamodb = new AWS.DynamoDB();
  const dynamoRequests = 4000;
  const promises = [];
  for (let i = 0; i < dynamoRequests; i++) {
    const promise = dynamodb.listTables().promise();
    promises.push(promise);
  }
  await Promise.all(promises);
};

const childFn = async () => {
  await nidleeRequest();
  return 'ALL GOOD';
};

exports.handler = lumigo.trace(childFn);
