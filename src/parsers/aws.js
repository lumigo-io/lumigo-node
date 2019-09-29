import { parseQueryParams } from '../utils';
import parseXml from '../tools/xmlToJson';

export const dynamodbParser = requestData => {
  const { headers: reqHeaders, body: reqBody } = requestData;
  const dynamodbMethod =
    (reqHeaders['X-Amz-Target'] && reqHeaders['X-Amz-Target'].split('.')[1]) ||
    '';

  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  const resourceName =
    (reqBodyJSON['TableName'] && reqBodyJSON.TableName) || '';

  const awsServiceData = { resourceName, dynamodbMethod };
  return { awsServiceData };
};

export const lambdaParser = (requestData, responseData) => {
  const { path, headers } = requestData;
  const resourceName = path.split('/')[3]; // FunctionName
  const invocationType = headers['x-amz-invocation-type'];
  const { headers: responseHeaders } = responseData;
  const spanId =
    responseHeaders['x-amzn-requestid'] ||
    responseHeaders['x-amz-requestid'] ||
    '';
  const awsServiceData = { resourceName, invocationType };
  return { awsServiceData, spanId };
};

export const snsParser = (requestData, responseData) => {
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData;
  const parsedRequestBody = reqBody ? parseQueryParams(reqBody) : undefined;
  const parsedResponseBody = resBody ? parseXml(resBody) : undefined;
  const resourceName = parsedRequestBody
    ? parsedRequestBody['TopicArn']
    : undefined;
  const messageId = parsedResponseBody
    ? ((parsedResponseBody['PublishResponse'] || {})['PublishResult'] || {})[
        'MessageId'
      ]
    : undefined;

  const awsServiceData = { resourceName, targetArn: resourceName, messageId };
  return { awsServiceData };
};

export const sqsParser = requestData => {
  const { body: reqBody } = requestData;
  const parsedBody = reqBody ? parseQueryParams(reqBody) : undefined;
  const resourceName = parsedBody ? parsedBody['QueueUrl'] : undefined;
  const awsServiceData = { resourceName };
  return { awsServiceData };
};

export const kinesisParser = (requestData, responseData) => {
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData;
  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  const resBodyJSON = (!!resBody && JSON.parse(resBody)) || {};
  const resourceName =
    (reqBodyJSON['StreamName'] && reqBodyJSON.StreamName) || undefined;
  const awsServiceData = { resourceName };
  if (resBodyJSON['SequenceNumber']) {
    awsServiceData.messageId = resBodyJSON['SequenceNumber'];
  }
  if (Array.isArray(resBodyJSON['Records'])) {
    awsServiceData.messageIds = resBodyJSON['Records']
      .map(r => r['SequenceNumber'])
      .filter(x => !!x);
  }
  return { awsServiceData };
};

export const awsParser = (requestData, responseData) => {
  const { headers: resHeader } = responseData;
  const messageId = resHeader
    ? resHeader['x-amzn-requestid'] || resHeader['x-amz-request-id']
    : undefined;

  const awsServiceData = { messageId };
  return messageId ? { awsServiceData } : {};
};
