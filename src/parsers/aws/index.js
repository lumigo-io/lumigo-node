export const dynamodbParser = (requestData, responseData) => {
  const { headers: reqHeaders, body: reqBody } = requestData;
  const { headers: resHeaders, body: resBody } = responseData;

  console.log(responseData);

  const name = '';
  const dynamodbMethod =
    (reqHeaders['X-Amz-Target'] && reqHeaders['X-Amz-Target'].split('.')[1]) ||
    '';

  switch (dynamodbMethod) {
    case 'GetItem':
      console.log('CD');
      console.log(reqBody);
      console.log('AB');
      break;
  }

  return { name, dynamodbMethod };
};

export const snsParser = (requestData, responseData) => {
  const {} = requestData;
  return {};
};

export const lambdaParser = (requestData, responseData) => {
  return {};
};

export const kinesisParser = (requestData, responseData) => {
  return {};
};
