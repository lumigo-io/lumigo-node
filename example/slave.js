const token = 't_2bbf570ddcb4ed8a3630';
const edgeHost = '336baui8uh.execute-api.us-west-2.amazonaws.com';
const debug = true;
const lumigo = require('@lumigo/tracer')({ token, edgeHost, debug });

const AWS = require('aws-sdk');

const putToDynamoDb = async message => {
  const dynamodb = new AWS.DynamoDB({
    region: 'us-west-2',
  });
  const params = {
    TableName: 'dori-table-test',
    Item: {
      id: { S: JSON.stringify(Math.random() * 10000) },
      message: { S: message },
    },
  };
  await dynamodb.putItem(params).promise();
};

const slaveFn = async () => {
  await putToDynamoDb('Yoga with uri');
  console.log('SLAVE 1 - ALL GOOD');
  return 'SLAVE 1 - ALL GOOD';
};

exports.handler = lumigo.trace(slaveFn);
