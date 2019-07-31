import * as aws from './aws';

describe('aws parser', () => {
  test('dynamodbParser', () => {
    const resourceName = 'TabulaRasa';
    const dynamodbMethod = 'GetItem';
    const xAmzTarget = `DynamoDB_20120810.${dynamodbMethod}`;

    const body = JSON.stringify({ TableName: resourceName });
    const headers = {
      'X-Amz-Target': xAmzTarget,
    };

    const requestData = { headers, body };
    const expected = { awsServiceData: { resourceName, dynamodbMethod } };
    expect(aws.dynamodbParser(requestData)).toEqual(expected);

    const headers2 = {};
    const body2 = JSON.stringify({});
    const requestData2 = { headers: headers2, body: body2 };
    const expected2 = {
      awsServiceData: { resourceName: '', dynamodbMethod: '' },
    };
    expect(aws.dynamodbParser(requestData2)).toEqual(expected2);
  });

  test('lambdaParser', () => {
    const resourceName = 'FunctionName';
    const path = `/2015-03-31/functions/${resourceName}/invocations?Qualifier=Qualifier`;
    const invocationType = 'InvocationType';
    const headers = {
      'x-amz-invocation-type': invocationType,
    };
    const requestData = { path, headers };
    const spanId = '1234-abcd-efgh';
    const responseData = { headers: { 'x-amzn-requestid': spanId } };
    const expected = {
      awsServiceData: { resourceName, invocationType },
      spanId,
    };
    expect(aws.lambdaParser(requestData, responseData)).toEqual(expected);
  });

  test('snsParser -> happy flow', () => {
    const topicArn = 'SOME-TOPIC-ARN';
    const requestData = {
      path: '/',
      port: 443,
      host: 'sns.us-west-2.amazonaws.com',
      body: `Action=Publish&Message=Some%20Message%20to%20SNS&TopicArn=${topicArn}&Version=2010-03-31`,
      method: 'POST',
      headers: {
        'content-length': 137,
        host: 'sns.us-west-2.amazonaws.com',
        'x-amz-date': '20190730T080719Z',
      },
      protocol: 'https:',
      sendTime: 1564474039619,
    };

    const result = aws.snsParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        resourceName: topicArn,
        targetArn: topicArn,
      },
    });
  });

  test('snsParser -> not success and return default values', () => {
    const requestData = {
      path: '/',
      port: 443,
      host: 'sns.us-west-2.amazonaws.com',
      sendTime: 1564474039619,
    };

    const result = aws.snsParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        resourceName: undefined,
        targetArn: undefined,
      },
    });
  });

  test('sqsParser -> happy flow', () => {
    const queueUrl = 'https://sqs.us-west-2.amazonaws.com/33/random-queue-test';
    const encodedQueueUrl = encodeURIComponent(queueUrl);
    const requestData = {
      path: '/',
      port: 443,
      host: 'sqs.us-west-2.amazonaws.com',
      body: `Action=SendMessage&DelaySeconds=1&MessageBody=Some%20Message%20to%20SQS&QueueUrl=${encodedQueueUrl}`,
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
        'content-length': 172,
        host: 'sqs.us-west-2.amazonaws.com',
        'x-amz-date': '20190730T082312Z',
      },
      protocol: 'https:',
      sendTime: 1564474992235,
    };

    const result = aws.sqsParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        resourceName: queueUrl,
      },
    });
  });

  test('sqsParser -> not success and return default values', () => {
    const requestData = {
      path: '/',
      host: 'sqs.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const result = aws.sqsParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        resourceName: undefined,
      },
    });
  });

  test('kinesisParser -> happy flow', () => {
    const streamName = 'RANDOM-STREAM-NAME';
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
      body: JSON.stringify({ StreamName: streamName }),
    };

    const result = aws.kinesisParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        resourceName: streamName,
      },
    });
  });

  test('kinesisParser -> not success and return default values', () => {
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const result = aws.kinesisParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        resourceName: undefined,
      },
    });
  });
});
