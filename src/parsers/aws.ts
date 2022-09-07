import { md5Hash, parseQueryParams, removeDuplicates, safeGet, safeJsonParse } from '../utils';
import { traverse } from '../tools/xmlToJson';
import * as logger from '../logger';

const extractDynamodbMessageId = (reqBody, method) => {
  if (method === 'PutItem' && reqBody['Item']) {
    return md5Hash(reqBody.Item);
  } else if (method === 'UpdateItem' && reqBody['Key']) {
    return md5Hash(reqBody.Key);
  } else if (method === 'DeleteItem' && reqBody['Key']) {
    return md5Hash(reqBody.Key);
  } else if (method === 'BatchWriteItem') {
    const firstTableName = Object.keys(reqBody.RequestItems)[0];
    if (firstTableName) {
      const firstItem = reqBody.RequestItems[firstTableName][0];
      if (firstItem['PutRequest']) {
        return md5Hash(firstItem.PutRequest.Item);
      } else if (firstItem['DeleteRequest']) {
        return md5Hash(firstItem.DeleteRequest.Key);
      }
    }
  }
  return undefined;
};

const extractDynamodbTableName = (reqBody, method) => {
  const tableName = (reqBody['TableName'] && reqBody.TableName) || '';
  if (!tableName && ['BatchWriteItem', 'BatchGetItem'].includes(method)) {
    return Object.keys(reqBody.RequestItems)[0];
  }
  return tableName;
};

export const dynamodbParser = (requestData) => {
  const { headers: reqHeaders, body: reqBody } = requestData;
  const dynamodbMethod =
    (reqHeaders['x-amz-target'] && reqHeaders['x-amz-target'].split('.')[1]) || '';

  let reqBodyJSON = safeJsonParse(reqBody, undefined);
  const resourceName = reqBodyJSON && extractDynamodbTableName(reqBodyJSON, dynamodbMethod);
  const messageId = reqBodyJSON && extractDynamodbMessageId(reqBodyJSON, dynamodbMethod);

  const awsServiceData = { resourceName, dynamodbMethod, messageId };
  return { awsServiceData };
};

// non-official
export const isArn = (arnToValidate) => {
  return arnToValidate.startsWith('arn:aws:');
};

export const extractLambdaNameFromArn = (arn) => arn.split(':')[6];

export const lambdaParser = (requestData, responseData) => {
  if (!responseData) return {};
  const { path, headers } = requestData;
  let resourceName = decodeURIComponent(path).split('/')[3];
  resourceName = isArn(resourceName) ? extractLambdaNameFromArn(resourceName) : resourceName;
  const invocationType = headers['x-amz-invocation-type'];
  const { headers: responseHeaders } = responseData;
  const spanId = responseHeaders
    ? responseHeaders['x-amzn-requestid'] || responseHeaders['x-amz-requestid'] || ''
    : '';
  const awsServiceData = { resourceName, invocationType };
  return { awsServiceData, spanId };
};

export const snsParser = (requestData, responseData) => {
  if (!responseData) return {};
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData;
  const parsedRequestBody = reqBody ? parseQueryParams(reqBody) : undefined;
  const parsedResponseBody = resBody ? traverse(resBody) : undefined;
  let resourceName = undefined;
  if (parsedRequestBody && parsedRequestBody['TopicArn']) {
    resourceName = parsedRequestBody['TopicArn'];
  } else if (parsedRequestBody && parsedRequestBody['TargetArn']) {
    resourceName = parsedRequestBody['TargetArn'];
  }
  const messageId = parsedResponseBody
    ? ((parsedResponseBody['PublishResponse'] || {})['PublishResult'] || {})['MessageId']
    : undefined;

  const awsServiceData = { resourceName, targetArn: resourceName, messageId };
  return { awsServiceData };
};

export const apigwParser = (requestData, responseData) => {
  if (!responseData) return {};
  const baseData = awsParser(requestData, responseData);
  if (!baseData.awsServiceData) {
    // @ts-ignore
    baseData.awsServiceData = {};
  }

  if (!baseData.awsServiceData.messageId) {
    const { headers: resHeader } = responseData;
    if (resHeader && resHeader['apigw-requestid']) {
      baseData.awsServiceData.messageId = resHeader['apigw-requestid'];
    }
  }

  return baseData;
};

export const eventBridgeParser = (requestData, responseData) => {
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData || {};
  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  const resBodyJSON = (!!resBody && JSON.parse(resBody)) || {};
  const resourceNames = reqBodyJSON.Entries
    ? removeDuplicates(reqBodyJSON.Entries.map((entry) => entry.EventBusName))
    : undefined;
  const messageIds = resBodyJSON.Entries
    ? resBodyJSON.Entries.map((entry) => entry.EventId)
    : undefined;
  const awsServiceData = { resourceNames, messageIds };
  return { awsServiceData };
};

export const sqsParser = (requestData, responseData) => {
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData || {};
  const parsedReqBody = reqBody ? parseQueryParams(reqBody) : undefined;
  const parsedResBody = resBody ? traverse(resBody) : undefined;
  const resourceName = parsedReqBody ? parsedReqBody['QueueUrl'] : undefined;
  const awsServiceData = { resourceName };
  // @ts-ignore
  awsServiceData.messageId =
    safeGet(parsedResBody, ['SendMessageResponse', 'SendMessageResult', 'MessageId'], undefined) ||
    safeGet(
      parsedResBody,
      [
        'SendMessageBatchResponse',
        'SendMessageBatchResult',
        'SendMessageBatchResultEntry',
        0,
        'MessageId',
      ],
      undefined
    ) ||
    safeGet(
      parsedResBody,
      [
        'SendMessageBatchResponse',
        'SendMessageBatchResult',
        'SendMessageBatchResultEntry',
        'MessageId',
      ],
      undefined
    );
  return { awsServiceData };
};

export const kinesisParser = (requestData, responseData) => {
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData;
  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  let resBodyJSON = {};
  try {
    resBodyJSON = (!!resBody && JSON.parse(resBody)) || {};
  } catch (e) {
    logger.info(`Unable to parse response, ${e}`);
    resBodyJSON = {};
  }
  const resourceName = (reqBodyJSON['StreamName'] && reqBodyJSON.StreamName) || undefined;
  const awsServiceData = { resourceName };
  if (resBodyJSON['SequenceNumber']) {
    // @ts-ignore
    awsServiceData.messageId = resBodyJSON['SequenceNumber'];
  }
  if (Array.isArray(resBodyJSON['Records'])) {
    // @ts-ignore
    awsServiceData.messageIds = resBodyJSON['Records']
      .map((r) => r['SequenceNumber'])
      .filter((x) => !!x);
  }
  return { awsServiceData };
};

export const awsParser = (requestData, responseData) => {
  if (!responseData) return {};
  const { headers: resHeader } = responseData;
  const messageId = resHeader
    ? resHeader['x-amzn-requestid'] || resHeader['x-amz-request-id']
    : undefined;

  const awsServiceData = { messageId };
  return messageId ? { awsServiceData } : {};
};
