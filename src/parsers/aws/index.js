export const dynamodbParser = requestData => {
  const { headers, body } = requestData;
  const { TableName: name = '' } = JSON.parse(body);
  const dynamodbMethod = headers['x-amz-target'] || '';
  return { name, dynamodbMethod };
};

export const snsParser = (requestData, responseData) => {
  return {};
};

export const lambdaParser = (requestData, responseData) => {
  return {};
};
