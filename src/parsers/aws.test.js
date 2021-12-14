import * as aws from './aws';
import { md5Hash } from '../utils';

describe('aws parser', () => {
  test('dynamodbParser', () => {
    const resourceName = 'TabulaRasa';

    const headersBad = {};
    const bodyBad = JSON.stringify({});
    const requestDataBad = { headers: headersBad, body: bodyBad };
    const expectedBad = {
      awsServiceData: { resourceName: '', dynamodbMethod: '' },
    };
    expect(aws.dynamodbParser(requestDataBad)).toEqual(expectedBad);

    const bodyGet = JSON.stringify({ TableName: resourceName });
    const headersGet = { 'x-amz-target': 'DynamoDB_20120810.GetItem' };
    const requestDataGet = { headers: headersGet, body: bodyGet };
    const expectedGet = {
      awsServiceData: { resourceName, dynamodbMethod: 'GetItem' },
    };
    expect(aws.dynamodbParser(requestDataGet)).toEqual(expectedGet);

    const bodyPut = JSON.stringify({
      TableName: resourceName,
      Item: { key: { S: 'value' } },
    });
    const headersPut = { 'x-amz-target': 'DynamoDB_20120810.PutItem' };
    const requestDataPut = { headers: headersPut, body: bodyPut };
    const expectedPut = {
      awsServiceData: {
        resourceName: resourceName,
        dynamodbMethod: 'PutItem',
        messageId: md5Hash({ key: { S: 'value' } }),
      },
    };
    expect(aws.dynamodbParser(requestDataPut)).toEqual(expectedPut);

    const bodyDelete = JSON.stringify({
      TableName: resourceName,
      Key: { key: { S: 'value' } },
    });
    const headersDelete = { 'x-amz-target': 'DynamoDB_20120810.DeleteItem' };
    const requestDataDelete = { headers: headersDelete, body: bodyDelete };
    const expectedDelete = {
      awsServiceData: {
        resourceName: resourceName,
        dynamodbMethod: 'DeleteItem',
        messageId: md5Hash({ key: { S: 'value' } }),
      },
    };
    expect(aws.dynamodbParser(requestDataDelete)).toEqual(expectedDelete);

    const bodyUpdate = JSON.stringify({
      TableName: resourceName,
      Key: { key: { S: 'value' } },
    });
    const headersUpdate = { 'x-amz-target': 'DynamoDB_20120810.UpdateItem' };
    const requestDataUpdate = { headers: headersUpdate, body: bodyUpdate };
    const expectedUpdate = {
      awsServiceData: {
        resourceName: resourceName,
        dynamodbMethod: 'UpdateItem',
        messageId: md5Hash({ key: { S: 'value' } }),
      },
    };
    expect(aws.dynamodbParser(requestDataUpdate)).toEqual(expectedUpdate);

    const bodyWriteBatch = JSON.stringify({
      RequestItems: {
        [resourceName]: [{ PutRequest: { Item: { key: { S: 'value' } } } }],
      },
    });
    const headersWriteBatch = {
      'x-amz-target': 'DynamoDB_20120810.BatchWriteItem',
    };
    const requestDataWriteBatch = {
      headers: headersWriteBatch,
      body: bodyWriteBatch,
    };
    const expectedWriteBatch = {
      awsServiceData: {
        resourceName: resourceName,
        dynamodbMethod: 'BatchWriteItem',
        messageId: md5Hash({ key: { S: 'value' } }),
      },
    };
    expect(aws.dynamodbParser(requestDataWriteBatch)).toEqual(expectedWriteBatch);

    const bodyGetBatch = JSON.stringify({
      RequestItems: {
        [resourceName]: {
          Keys: [{ key: { S: 'value' } }],
        },
      },
    });
    const headersGetBatch = {
      'x-amz-target': 'DynamoDB_20120810.BatchGetItem',
    };
    const requestDataGetBatch = {
      headers: headersGetBatch,
      body: bodyGetBatch,
    };
    const expectedDataGetBatch = {
      awsServiceData: {
        resourceName: resourceName,
        dynamodbMethod: 'BatchGetItem',
      },
    };
    expect(aws.dynamodbParser(requestDataGetBatch)).toEqual(expectedDataGetBatch);

    const bodyDeleteBatch = JSON.stringify({
      RequestItems: {
        [resourceName]: [{ DeleteRequest: { Key: { key: { S: 'value' } } } }],
      },
    });
    const headersDeleteBatch = {
      'x-amz-target': 'DynamoDB_20120810.BatchWriteItem',
    };
    const requestDataDeleteBatch = {
      headers: headersDeleteBatch,
      body: bodyDeleteBatch,
    };
    const expectedDeleteBatch = {
      awsServiceData: {
        resourceName: resourceName,
        dynamodbMethod: 'BatchWriteItem',
        messageId: md5Hash({ key: { S: 'value' } }),
      },
    };
    expect(aws.dynamodbParser(requestDataDeleteBatch)).toEqual(expectedDeleteBatch);
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

  test('lambdaParser with arn', () => {
    const resourceName = 'FunctionName';
    const arn = `arn:aws:lambda:eu-central-1:123847209798:function:${resourceName}`;
    const path = encodeURIComponent(
      `lambda.eu-central-1.amazonaws.com/2015-03-31/functions/${arn}/invocations?Qualifier=Qualifier`
    );
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
      body: '<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">\n  <PublishResult>\n    <MessageId>72eaeab7-267d-5bac-8eee-bf0d69758085</MessageId>\n  </PublishResult>\n  <ResponseMetadata>\n    <RequestId>3e7f7a41-4c85-5f51-8160-2ffb038d8478</RequestId>\n  </ResponseMetadata>\n</PublishResponse>\n',
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
      body: '<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">\n  <PublishResult>\n    <MessageId>72eaeab7-267d-5bac-8eee-bf0d69758085</MessageId>\n  </PublishResult>\n  <ResponseMetadata>\n    <RequestId>3e7f7a41-4c85-5f51-8160-2ffb038d8478</RequestId>\n  </ResponseMetadata>\n</PublishResponse>\n',
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

  [
    // send message single
    '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
    // send message batch (with one record)
    '<?xml version="1.0"?><SendMessageBatchResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageBatchResult><SendMessageBatchResultEntry><Id>11dd068c-fb3c-43e8-a2ae-1a914780735f</Id><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageBatchResultEntry></SendMessageBatchResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageBatchResponse>',
  ].map((responseDataBody) =>
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
      const responseData = { body: responseDataBody };

      const result = aws.sqsParser(requestData, responseData);

      expect(result).toEqual({
        awsServiceData: {
          resourceName: queueUrl,
          messageId: '85dc3997-b060-47bc-9d89-c754d7260dbd',
        },
      });
    })
  );

  test('sqsParser -> truncated body', () => {
    const queueUrl = 'https://sqs.us-west-2.amazonaws.com/33/random-queue-test';
    const encodedQueueUrl = encodeURIComponent(queueUrl);
    const requestData = {
      host: 'sqs.us-west-2.amazonaws.com',
      body: `QueueUrl=${encodedQueueUrl}&DelaySeconds=1%...[too long]`,
      method: 'POST',
      headers: {
        host: 'sqs.us-west-2.amazonaws.com',
      },
    };

    const result = aws.sqsParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        resourceName: queueUrl,
        messageId: null,
      },
    });
  });

  test('sqsParser -> empty request', () => {
    const result = aws.sqsParser({}, null);
    expect(result).toEqual({
      awsServiceData: {
        messageId: null,
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
        messageId: null,
        resourceName: undefined,
      },
    });
  });

  test('eventBridgeParser -> happy flow', () => {
    const requestData = {
      host: 'events.us-west-2.amazonaws.com',
      body: JSON.stringify({
        Entries: [
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 1}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 2}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 3}',
            EventBusName: 'test2',
          },
        ],
      }),
    };
    const responseData = {
      body: JSON.stringify({
        Entries: [{ EventId: '1-2-3-4' }, { EventId: '6-7-8-9' }],
        FailedEntryCount: 0,
      }),
    };

    const result = aws.eventBridgeParser(requestData, responseData);

    expect(result).toEqual({
      awsServiceData: {
        resourceNames: ['test', 'test2'],
        messageIds: ['1-2-3-4', '6-7-8-9'],
      },
    });
  });

  test('eventBridgeParser -> with response null', () => {
    const requestData = {
      host: 'events.us-west-2.amazonaws.com',
      body: JSON.stringify({
        Entries: [
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 1}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 2}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 3}',
            EventBusName: 'test2',
          },
        ],
      }),
    };
    const responseData = null;

    const result = aws.eventBridgeParser(requestData, responseData);

    expect(result).toEqual({
      awsServiceData: {
        resourceNames: ['test', 'test2'],
      },
    });
  });

  test('eventBridgeParser -> not success and return default values', () => {
    const requestData = {
      path: '/',
      host: 'events.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const result = aws.eventBridgeParser(requestData, {});

    expect(result).toEqual({
      awsServiceData: {
        messageIds: undefined,
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
        Records: [{ SequenceNumber: '1' }, { SequenceNumber: '2' }, { Error: true }],
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

  test('kinesisParser -> invalid response and return default values', () => {
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const responseData = {
      body: '<hello',
    };
    const result = aws.kinesisParser(requestData, responseData);

    expect(result).toEqual({
      awsServiceData: {
        resourceName: undefined,
      },
    });
  });

  test('apigwParser -> api-gw v1 (with x-amzn-requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'x-amzn-requestid': '123' },
    };

    const result = aws.apigwParser({}, responseData);

    expect(result).toEqual({
      awsServiceData: {
        messageId: '123',
      },
    });
  });

  test('apigwParser -> api-gw v2 (with Apigw-Requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'apigw-requestid': '123' },
    };

    const result = aws.apigwParser({}, responseData);

    expect(result).toEqual({
      awsServiceData: {
        messageId: '123',
      },
    });
  });

  test('apigwParser -> api-gw v2 (with x-amzn-Requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'Apigw-Requestid': '123', 'x-amzn-requestid': 'x-amzn-123' },
    };

    const result = aws.apigwParser({}, responseData);

    expect(result).toEqual({
      awsServiceData: {
        messageId: 'x-amzn-123',
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
