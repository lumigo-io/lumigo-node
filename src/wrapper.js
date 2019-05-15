import axios from 'axios';

/*
const isWarm = () =>
  Object.keys(process.env).filter(k => k.startsWith('LUMIGO_')).length > 0;

const setLumigoEnvironment = (lumigoContainerTimestamp, lumigoIsWarm) => {
  process.env['LUMIG_IS_WARM'] = lumigoIsWarm;
};

const getLumigoEnvironment = () => {
  if (!isWarm()) {
    const lumigoContainerTimestamp = new Date().getTime();
    const lumigoIsWarm = 1;
    setLumigoEnvironment();
  } else {
    const {
      LUMIGO_CONTAINER_TIMESTAMP: lumigoContainerTimestamp,
      LUMIGO_IS_WARM: lumigoIsWarm,
    } = process.env;
    return { lumigoContainerTimestamp, lumgioIsWarm };
  }
  const { LUMIGO_TRACER_CONTAINER_TIMESTAMP } = process.env;
};
*/

const getAWSEnvironment = () => {
  const {
    AWS_REGION: awsRegion,
    _X_AMZN_TRACE_ID: awsXAmznTraceId,
    AWS_EXECUTION_ENV: awsExecutionEnv,
    LAMBDA_TASK_ROOT: awsLambdaTaskRoot,
    LAMBDA_RUNTIME_DIR: awsLambdaRuntimeDir,
    AWS_LAMBDA_FUNCTION_NAME: awsLambdaFunctionName,
    AWS_LAMBDA_LOG_GROUP_NAME: awsLambdaLogGroupName,
    AWS_LAMBDA_LOG_STREAM_NAME: awsLambdaLogStreamName,
    AWS_LAMBDA_FUNCTION_VERSION: awsLambdaFunctionVersion,
    AWS_LAMBDA_FUNCTION_MEMORY_SIZE: awsLambdaFunctionMemorySize,
  } = process.env;
  return {
    awsRegion,
    awsExecutionEnv,
    awsXAmznTraceId,
    awsLambdaTaskRoot,
    awsLambdaRuntimeDir,
    awsLambdaFunctionName,
    awsLambdaLogGroupName,
    awsLambdaLogStreamName,
    awsLambdaFunctionVersion,
    awsLambdaFunctionMemorySize,
  };
};


