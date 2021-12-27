/* eslint-disable no-console */

const token = 'XXX';
const debug = true;
const lumigo = require('@lumigo/tracer')({ token, debug });

const AWS = require('aws-sdk');

const handler = async () => {
  const dynamodb = new AWS.DynamoDB();
  const params = {
    TableName: 'test-table',
    Item: {
      id: { S: JSON.stringify(Math.random() * 10000) },
      message: { S: 'DummyMessage' },
    },
  };
  await dynamodb
    .putItem(params)
    .promise()
    .catch(e => {
      console.log('Error while putting record into DDB', e);
    });
  return 'OK';
};

exports.handler = lumigo.trace(handler);
