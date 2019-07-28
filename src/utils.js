import { TracerGlobals } from './globals';
import https from 'https';
import crypto from 'crypto';

export const SPAN_PATH = '/api/spans';
export const LUMIGO_TRACER_EDGE = 'lumigo-tracer-edge.golumigo.com';

export const getContextInfo = context => {
  const remainingTimeInMillis = context.getRemainingTimeInMillis();
  const {
    functionName,
    awsRequestId,
    invokedFunctionArn,
    callbackWaitsForEmptyEventLoop,
  } = context;
  const awsAccountId = invokedFunctionArn
    ? invokedFunctionArn.split(':')[4]
    : '';

  return {
    functionName,
    awsRequestId,
    awsAccountId,
    remainingTimeInMillis,
    callbackWaitsForEmptyEventLoop,
  };
};

export const getAccountIdFromInvokedFunctinArn = invokedFunctionArn =>
  invokedFunctionArn ? invokedFunctionArn.split(':')[4] : '';

export const getAccountId = context => {
  const { invokedFunctionArn } = context;
  const awsAccountId = getAccountIdFromInvokedFunctinArn(invokedFunctionArn);
  return awsAccountId;
};

export const getTracerInfo = () => {
  const pkg = require('../package.json');
  const { name, version } = pkg;
  return { name, version };
};

export const getTraceId = awsXAmznTraceId => {
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

export const getPatchedTraceId = awsXAmznTraceId => {
  const { Root, Parent, Sampled, transactionId } = getTraceId(awsXAmznTraceId);
  const rootArr = Root.split('-');
  const shortId = getRandomString(4);
  return `Root=${
    rootArr[0]
  }-0000${shortId}-${transactionId};Parent=${Parent};Sampled=${Sampled}`;
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

export const isAwsEnvironment = () => !!process.env['LAMBDA_RUNTIME_DIR'];

export const isVerboseMode = () =>
  !!(process.env['LUMIGO_VERBOSE'] && process.env.LUMIGO_VERBOSE === 'TRUE');

export const isWarm = () =>
  !!(process.env['LUMIGO_IS_WARM'] && process.env.LUMIGO_IS_WARM === 'TRUE');

export const isPruneTraceOff = () =>
  !!(
    process.env['LUMIGO_PRUNE_TRACE_OFF'] &&
    process.env.LUMIGO_PRUNE_TRACE_OFF === 'TRUE'
  );

export const isDebug = () => {
  const isDebugFromEnv = !!(
    process.env['LUMIGO_DEBUG'] &&
    process.env.LUMIGO_DEBUG.toUpperCase() === 'TRUE'
  );
  const { debug: isDebugFromTracerInput } = TracerGlobals.getTracerInputs();
  return isDebugFromEnv || isDebugFromTracerInput;
};

export const isSwitchedOff = () => {
  const isSwitchedOffFromEnv = !!(
    process.env['LUMIGO_SWITCH_OFF'] && process.env.LUMIGO_SWITCH_OFF === 'TRUE'
  );
  const {
    switchOff: isSwitchedOffFromTracerInput,
  } = TracerGlobals.getTracerInputs();

  return isSwitchedOffFromEnv || isSwitchedOffFromTracerInput;
};

export const setWarm = () => (process.env['LUMIGO_IS_WARM'] = 'TRUE');

export const setPruneTraceOff = () =>
  (process.env['LUMIGO_PRUNE_TRACE_OFF'] = 'TRUE');

export const setVerboseMode = () => (process.env['LUMIGO_VERBOSE'] = 'TRUE');

export const setSwitchOff = () => (process.env['LUMIGO_SWITCH_OFF'] = 'TRUE');

export const setDebug = () => (process.env['LUMIGO_DEBUG'] = 'TRUE');

export const isString = x =>
  Object.prototype.toString.call(x) === '[object String]';

export const MAX_ENTITY_SIZE = 1024;

export const prune = (str, maxLength = MAX_ENTITY_SIZE) =>
  str.substr(0, maxLength);

export const stringifyAndPrune = (obj, maxLength = MAX_ENTITY_SIZE) =>
  prune(JSON.stringify(obj), maxLength);

export const pruneData = (data, maxLength) =>
  isString(data) ? prune(data, maxLength) : stringifyAndPrune(data, maxLength);

export const stringifyError = err => {
  const error = JSON.stringify(err, Object.getOwnPropertyNames(err));
  return error;
};

export const lowerCaseObjectKeys = o =>
  o
    ? Object.keys(o).reduce((c, k) => ((c[k.toLowerCase()] = o[k]), c), {})
    : {};

export const getRandomString = evenNrChars =>
  crypto
    .randomBytes(evenNrChars / 2)
    .toString('hex')
    .toLowerCase();

export const getRandomId = () => {
  const p1 = getRandomString(8);
  const p2 = getRandomString(4);
  const p3 = getRandomString(4);
  const p4 = getRandomString(4);
  const p5 = getRandomString(12);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
};

export const isAwsService = host => !!(host && host.includes('amazonaws.com'));

export const removeLumigoFromStacktrace = handleReturnValue => {
  const { err, data, type } = handleReturnValue;
  if (!err || !err.stack) {
    return handleReturnValue;
  }
  const { stack } = err;
  const stackArr = stack.split('\n');

  const pattern = '/dist/lumigo.js:';
  const reducer = (acc, v, i) => {
    if (v.includes(pattern)) {
      acc.push(i);
    }
    return acc;
  };

  const pattrenIndices = stackArr.reduce(reducer, []);

  const minIndex = pattrenIndices.shift();
  const maxIndex = pattrenIndices.pop();
  const nrItemsToRemove = maxIndex - minIndex + 1;

  stackArr.splice(minIndex, nrItemsToRemove);
  err.stack = stackArr.join('\n');

  return { err, data, type };
};

export const httpsAgent = new https.Agent({ keepAlive: true });

export const httpReq = (options = {}, reqBody) =>
  new Promise((resolve, reject) => {
    options.agent = httpsAgent;
    const req = https.request(options, res => {
      const { statusCode } = res;
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve({ statusCode, data }));
    });
    req.on('error', e => reject(e));
    !!reqBody && req.write(reqBody);
    req.end();
  });

export const getAwsEdgeHost = () => {
  const { awsRegion } = getAWSEnvironment();
  return `${awsRegion}.${LUMIGO_TRACER_EDGE}`;
};

export const addHeaders = (currentHeaders, headersToAssign) =>
  Object.assign({}, currentHeaders, headersToAssign);

export const getEdgeHost = () => {
  const { edgeHost } = TracerGlobals.getTracerInputs();
  if (edgeHost) {
    return edgeHost;
  }
  const awsEdgeHost = getAwsEdgeHost();
  return awsEdgeHost;
};

export const getEdgeUrl = () => {
  const host = getEdgeHost();
  const path = SPAN_PATH;
  return { host, path };
};

//Base64 calculation taken from : https://stackoverflow.com/questions/13378815/base64-length-calculation
export const getJSONBase64Size = obj => {
  return Math.ceil((Buffer.byteLength(JSON.stringify(obj), 'utf8') / 3) * 4);
};

export const callAfterEmptyEventLoop = (fn, args) =>
  process.prependOnceListener('beforeExit', async () => await fn(...args));
