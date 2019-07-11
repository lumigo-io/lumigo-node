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

/*eslint-disable */
export const snsParser = (requestData, responseData) => {
  return {};
};

export const kinesisParser = (requestData, responseData) => {
  return {};
};
/*eslint-enable */
