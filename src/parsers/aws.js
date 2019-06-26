export const dynamodbParser = requestData => {
  const { headers: reqHeaders, body: reqBody } = requestData;
  const dynamodbMethod =
    (reqHeaders['X-Amz-Target'] && reqHeaders['X-Amz-Target'].split('.')[1]) ||
    '';

  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  const resourceName =
    (reqBodyJSON['TableName'] && reqBodyJSON.TableName) || '';

  return { resourceName, dynamodbMethod };
};

/*eslint-disable */
export const snsParser = (requestData, responseData) => {
  return {};
};

export const lambdaParser = (requestData, responseData) => {
  return {};
};

export const kinesisParser = (requestData, responseData) => {
  return {};
};
/*eslint-enable */
