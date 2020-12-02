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

const postToSns = async message => {
  const sns = new AWS.SNS({
    region: 'us-east-1',
  });
  const topicArn = `arn:aws:sns:us-east-1:335722316285:slave-test-topic`;
  await sns.publish({ TopicArn: topicArn, Message: message }).promise();
};

const postToSqs = async message => {
  const sqs = new AWS.SQS({
    region: 'us-west-2',
  });
  const queueUrl = `https://sqs.us-west-2.amazonaws.com/335722316285/dori-test-sqs`;

  const params = {
    DelaySeconds: 1,
    MessageBody: message,
    QueueUrl: queueUrl,
  };

  await sqs.sendMessage(params).promise();
};

const postToS3 = async () => {
  const S3 = new AWS.S3({
    region: 'us-west-2',
  });
  let keyName = 'tmp.txt';
  let objectParams = {
    Bucket: 'dori-test-bucket',
    Key: keyName,
    Body: 'Hello Lumigo!',
  };
  await S3.putObject(objectParams).promise();
};

const childFn = async () => {
  await postToSns('Some Message to SNS');
  // eslint-disable-next-line no-console
  console.log('ALL GOOD');
  return 'ALL GOOD';
};

exports.handler = lumigo.trace(async () => {});
