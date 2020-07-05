export const createAwsEnvVars = () => ({
  LAMBDA_TASK_ROOT: '/var/task',
  LAMBDA_RUNTIME_DIR: '/var/runtime',
  AWS_REGION: 'us-east-1',
  AWS_DEFAULT_REGION: 'us-east-1',
  AWS_LAMBDA_LOG_GROUP_NAME: '/aws/lambda/aws-nodejs-dev-hello',
  AWS_LAMBDA_LOG_STREAM_NAME:
    '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
  AWS_LAMBDA_FUNCTION_NAME: 'aws-nodejs-dev-hello',
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: '1024',
  AWS_LAMBDA_FUNCTION_VERSION: '$LATEST',
  _AWS_XRAY_DAEMON_ADDRESS: '169.254.79.2',
  _AWS_XRAY_DAEMON_PORT: '2000',
  AWS_XRAY_DAEMON_ADDRESS: '169.254.79.2:2000',
  AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
  _X_AMZN_TRACE_ID:
    'Root=1-5cdcf03a-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0',
  AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs8.10',
});

export const createContext = () => ({
  getRemainingTimeInMillis: () => 1
});
