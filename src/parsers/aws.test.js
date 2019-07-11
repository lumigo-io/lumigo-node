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

  test('snsParser', () => {
    expect(aws.snsParser()).toEqual({});
  });

  test('kinesisParser', () => {
    expect(aws.kinesisParser()).toEqual({});
  });
});
