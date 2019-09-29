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

  test('snsParser -> happy flow (request)', () => {
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

  test('snsParser -> happy flow (response)', () => {
    const response = {
      statusCode: 200,
      receivedTime: 1564495048705,
      body:
        '<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">\n  <PublishResult>\n    <MessageId>72eaeab7-267d-5bac-8eee-bf0d69758085</MessageId>\n  </PublishResult>\n  <ResponseMetadata>\n    <RequestId>3e7f7a41-4c85-5f51-8160-2ffb038d8478</RequestId>\n  </ResponseMetadata>\n</PublishResponse>\n',
      headers: {
        'x-amzn-requestid': '3e7f7a41-4c85-5f51-8160-2ffb038d8478',
        'x-amzn-trace-id':
          'Root=1-00007c9f-1f11443016dcb3200b19bbc0;Parent=3bfa041a0ae54e47;Sampled=0',
        'content-type': 'text/xml',
        'content-length': '294',
        date: 'Tue, 30 Jul 2019 13:57:27 GMT',
      },
    };

    const result = aws.snsParser({}, response);

    expect(result).toEqual({
      awsServiceData: {
        messageId: '72eaeab7-267d-5bac-8eee-bf0d69758085',
        resourceName: undefined,
        targetArn: undefined,
      },
    });
  });

  test('snsParser -> happy flow (request + response)', () => {
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

    const response = {
      statusCode: 200,
      receivedTime: 1564495048705,
      body:
        '<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">\n  <PublishResult>\n    <MessageId>72eaeab7-267d-5bac-8eee-bf0d69758085</MessageId>\n  </PublishResult>\n  <ResponseMetadata>\n    <RequestId>3e7f7a41-4c85-5f51-8160-2ffb038d8478</RequestId>\n  </ResponseMetadata>\n</PublishResponse>\n',
      headers: {
        'x-amzn-requestid': '3e7f7a41-4c85-5f51-8160-2ffb038d8478',
        'x-amzn-trace-id':
          'Root=1-00007c9f-1f11443016dcb3200b19bbc0;Parent=3bfa041a0ae54e47;Sampled=0',
        'content-type': 'text/xml',
        'content-length': '294',
        date: 'Tue, 30 Jul 2019 13:57:27 GMT',
      },
    };

    const result = aws.snsParser(requestData, response);

    expect(result).toEqual({
      awsServiceData: {
        messageId: '72eaeab7-267d-5bac-8eee-bf0d69758085',
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
        messageId: undefined,
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

  test('kinesisParser -> happy flow single put', () => {
    const streamName = 'RANDOM-STREAM-NAME';
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
      body: JSON.stringify({ StreamName: streamName }),
    };
    const responseData = {
      body: JSON.stringify({ SequenceNumber: '1' }),
    };

    const result = aws.kinesisParser(requestData, responseData);

    expect(result).toEqual({
      awsServiceData: {
        resourceName: streamName,
        messageId: '1',
      },
    });
  });

  test('kinesisParser -> happy flow batch put', () => {
    const streamName = 'RANDOM-STREAM-NAME';
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
      body: JSON.stringify({ StreamName: streamName }),
    };
    const responseData = {
      body: JSON.stringify({
        Records: [
          { SequenceNumber: '1' },
          { SequenceNumber: '2' },
          { Error: true },
        ],
      }),
    };

    const result = aws.kinesisParser(requestData, responseData);

    expect(result).toEqual({
      awsServiceData: {
        resourceName: streamName,
        messageIds: ['1', '2'],
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

  test('awsParser -> happy flow (with x-amzn-requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'x-amzn-requestid': '123' },
    };

    const result = aws.awsParser({}, responseData);

    expect(result).toEqual({
      awsServiceData: {
        messageId: '123',
      },
    });
  });

  test('awsParser -> happy flow (without x-amzn-requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { hello: 'world' },
    };

    const result = aws.awsParser({}, responseData);

    expect(result).toEqual({});
  });
});
