import axios from 'axios';

export const getContextInfo = context => {
  const remainingTimeInMillis = context.getRemainingTimeInMillis();
  const { functionName, awsRequestId } = context;
  return { functionName, awsRequestId, remainingTimeInMillis };
};

export const getTracerInfo = () => {
  const pkg = require('../package.json');
  const { name, version } = pkg;
  return { name, version };
};

export const getTraceId = awsXAmznTraceId => {
  // XXX Consider putting condition in parent.
  if (!awsXAmznTraceId) {
    throw new Error('Missing _X_AMZN_TRACE_ID in Lambda Env Vars.');
  }

  const traceIdArr = awsXAmznTraceId.split(';');
  if (traceIdArr.length !== 3) {
    throw new Error(
      'Expected 3 semi-colon separated parts in _X_AMZN_TRACE_ID.'
    );
  }

  const traceId = {};
  // XXX Populates Root, Parent and Sampled keys.
  traceIdArr.forEach(item => {
    const [key, value] = item.split('=');
    traceId[key] = value;
  });

  if (!traceId['Root'] || !traceId['Parent'] || !traceId['Sampled']) {
    throw new Error(`Either Root, Parent or Sampled weren't found in traceId.`);
  }

  const transactionId = traceId.Root.split('-')[2];

  traceId.transactionId = transactionId;

  return traceId;
};

export const isAsyncFn = fn =>
  fn &&
  fn['constructor'] &&
  fn.constructor['name'] &&
  fn.constructor.name === 'AsyncFunction';

export const getAWSEnvironment = () => {
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

export const isVerboseMode = () =>
  !!(process.env['LUMIGO_VERBOSE'] && process.env.LUMIGO_VERBOSE === 'TRUE');

export const isWarm = () =>
  !!(process.env['LUMIGO_IS_WARM'] && process.env.LUMIGO_IS_WARM === 'TRUE');

export const isDebug = () =>
  !!(process.env['LUMIGO_DEBUG'] && process.env.LUMIGO_DEBUG === 'TRUE');

export const isSwitchedOff = () =>
  !!(
    process.env['LUMIGO_SWITCH_OFF'] && process.env.LUMIGO_SWITCH_OFF === 'TRUE'
  );

export const setWarm = () => (process.env['LUMIGO_IS_WARM'] = 'TRUE');
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
