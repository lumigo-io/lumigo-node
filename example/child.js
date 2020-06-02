const token = 't_de9ec97c5fec3a1a924c';
const edgeHost = 'tracer-edge.internal-monitoring.golumigo.com';
const debug = false;
const lumigo = require('@lumigo/tracer')({ token, edgeHost, debug });

const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB({
  region: 'us-east-1',
});

const scanTable = async filter => {
  const params = {
    TableName: 'dori-table-test',
    Limit: 1,
    FilterExpression: '#user_status = :user_status_val',
    ExpressionAttributeNames: {
      '#user_status': 'user_status',
    },
    ExpressionAttributeValues: { ':user_status_val': `somestatus - ${filter}` },
  };
  await dynamodb.scan(params).promise();
};

const putToDynamoDb = async message => {
  const params = {
    TableName: 'dori-table-test',
    Item: {
      id: { S: JSON.stringify(Math.random() * 10000) },
      message: { S: message },
    },
  };
  await dynamodb.putItem(params).promise();
};

const childFn = async () => {
  const promises = [];
  for (let i = 0; i < 4700; i++) {
    promises.push(putToDynamoDb(`Some Message ${i}`));
  }
  await Promise.all(promises);
  console.log('Done');
  return 'ALL GOOD';
};

exports.handler = lumigo.trace(childFn);
