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
    const expected = { resourceName, dynamodbMethod };
    expect(aws.dynamodbParser(requestData)).toEqual(expected);

    const headers2 = {};
    const body2 = JSON.stringify({});
    const requestData2 = { headers: headers2, body: body2 };
    const expected2 = { resourceName: '', dynamodbMethod: '' };
    expect(aws.dynamodbParser(requestData2)).toEqual(expected2);
  });

  test('snsParser', () => {
    expect(aws.snsParser()).toEqual({});
  });

  test('lambdaParser', () => {
    expect(aws.lambdaParser()).toEqual({});
  });

  test('kinesisParser', () => {
    expect(aws.kinesisParser()).toEqual({});
  });
});
