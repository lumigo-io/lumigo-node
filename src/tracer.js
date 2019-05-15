import { getAWSEnvironment } from './utils';

const beforeUserHandler = () => {
  const awsEnv = getAWSEnvironment();
  console.log(awsEnv);
};

export const trace = (token, eventFilter) => userHandler => (
  event,
  context,
  callback
) => {
  const ret = userHandler(event, context, callback);
  return ret;
};
