import { TracerGlobals } from './globals';
import https from 'https';
import crypto from 'crypto';
import { noCirculars } from './tools/noCirculars';
import * as logger from './logger';

export const SPAN_PATH = '/api/spans';
export const LUMIGO_TRACER_EDGE = 'lumigo-tracer-edge.golumigo.com';
export const LUMIGO_DEFAULT_DOMAIN_SCRUBBERS =
  '["secretsmanager.*.amazonaws.com", "ssm.*.amazonaws.com", "kms.*.amazonaws.com", "sts..*amazonaws.com"]';
export const LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP =
  'LUMIGO_BLACKLIST_REGEX';
export const LUMIGO_SECRET_MASKING_REGEX = 'LUMIGO_SECRET_MASKING_REGEX';
export const OMITTING_KEYS_REGEXES = [
  '.*pass.*',
  '.*key.*',
  '.*secret.*',
  '.*credential.*',
  '.*passphrase.*',
  'SessionToken',
  'x-amz-security-token',
  'Signature',
  'Credential',
  'Authorization',
];
export const LUMIGO_EVENT_KEY = '_lumigo';
export const STEP_FUNCTION_UID_KEY = 'step_function_uid';
export const GET_KEY_DEPTH_ENV_KEY = 'LUMIGO_KEY_DEPTH';
export const DEFAULT_GET_KEY_DEPTH = 3;
export const EXECUTION_TAGS_KEY = 'lumigo_execution_tags_no_scrub';
export const SKIP_SCRUBBING_KEYS = [EXECUTION_TAGS_KEY];

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

export const isPromise = obj =>
  obj && obj.then && typeof obj.then === 'function';

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

const TIMEOUT_ENABLE_FLAG = 'LUMIGO_TIMEOUT_TIMER_ENABLED';
const WARM_FLAG = 'LUMIGO_IS_WARM';
const HTTP_WRAPPED_FLAG = 'LUMIGO_IS_HTTP_WRAPPED';
const VERBOSE_FLAG = 'LUMIGO_VERBOSE';
const SEND_ONLY_IF_ERROR_FLAG = 'SEND_ONLY_IF_ERROR';
const PRUNE_TRACE_OFF_FLAG = 'LUMIGO_PRUNE_TRACE_OFF';
const STORE_LOGS_FLAG = 'LUMIGO_STORE_LOGS';

const validateEnvVar = (envVar, value = 'TRUE') =>
  !!(
    process.env[envVar] &&
    process.env[envVar].toUpperCase() === value.toUpperCase()
  );

export const isAwsEnvironment = () => !!process.env['LAMBDA_RUNTIME_DIR'];

export const getEnvVarAsList = (key, def) => {
  if (process.env[key] != null) {
    return process.env[key].split(',');
  }
  return def;
};

export const isTimeoutTimerEnabled = () =>
  !validateEnvVar(TIMEOUT_ENABLE_FLAG, 'FALSE');

export const isVerboseMode = () => validateEnvVar(VERBOSE_FLAG);

export const isWarm = () => validateEnvVar(WARM_FLAG);

export const isHttpWrapped = () => validateEnvVar(HTTP_WRAPPED_FLAG);

export const setHttpWrapped = () => (process.env[HTTP_WRAPPED_FLAG] = 'TRUE');

export const isStoreLogs = () => validateEnvVar(STORE_LOGS_FLAG);

export const isSendOnlyIfErrors = () => validateEnvVar(SEND_ONLY_IF_ERROR_FLAG);

export const isPruneTraceOff = () => validateEnvVar(PRUNE_TRACE_OFF_FLAG);

export const isSwitchedOff = () =>
  safeExecute(() => {
    return (
      TracerGlobals.getTracerInputs().switchOff ||
      isSwitchOffEnvVar() ||
      !isValidAlias()
    );
  })();

export const isStepFunction = () =>
  safeExecute(() => TracerGlobals.getTracerInputs().isStepFunction)();

export const getValidAliases = () =>
  safeExecute(() => {
    return JSON.parse(process.env['LUMIGO_VALID_ALIASES'] || '[]');
  })() || [];

export const getHandlerContext = () =>
  TracerGlobals.getHandlerInputs().context || {};

export const getInvokedArn = () => getHandlerContext().invokedFunctionArn || '';
export const getInvokedVersion = () =>
  getHandlerContext().functionVersion || '';

export const getInvokedAliasOrNull = () =>
  safeExecute(() => {
    return getInvokedArn().split(':').length >= 8
      ? getInvokedArn().split(':')[7]
      : null;
  })() || null;

export const isValidAlias = () => {
  const validAliases = getValidAliases();
  const currentAlias = getInvokedAliasOrNull();
  const validAlias =
    validAliases.length === 0 || validAliases.includes(currentAlias);
  if (!validAlias) {
    logger.info(`Alias is invalid, alias: ${currentAlias}`);
  }
  return validAlias;
};

export const setWarm = () => (process.env[WARM_FLAG] = 'TRUE');

export const setSendOnlyIfErrors = () =>
  (process.env[SEND_ONLY_IF_ERROR_FLAG] = 'TRUE');

export const setPruneTraceOff = () =>
  (process.env[PRUNE_TRACE_OFF_FLAG] = 'TRUE');

export const setStoreLogsOn = () => (process.env[STORE_LOGS_FLAG] = 'TRUE');

export const setVerboseMode = () => (process.env[VERBOSE_FLAG] = 'TRUE');

export const setSwitchOff = () => (process.env['LUMIGO_SWITCH_OFF'] = 'TRUE');

export const isSwitchOffEnvVar = () => validateEnvVar('LUMIGO_SWITCH_OFF');

export const setDebug = () => (process.env['LUMIGO_DEBUG'] = 'TRUE');

export const setTimeoutTimerDisabled = () =>
  (process.env[TIMEOUT_ENABLE_FLAG] = 'FALSE');

export const isString = x =>
  Object.prototype.toString.call(x) === '[object String]';

export const MAX_ENTITY_SIZE = 1024;

export const getEventEntitySize = () => {
  return parseInt(process.env['MAX_EVENT_ENTITY_SIZE']) || MAX_ENTITY_SIZE;
};

export const prune = (str, maxLength = MAX_ENTITY_SIZE) =>
  (str || '').substr(0, maxLength);

export const stringifyAndPrune = (obj, maxLength = MAX_ENTITY_SIZE) =>
  prune(JSON.stringify(obj), maxLength);

export const pruneData = (data, maxLength) =>
  isString(data) ? prune(data, maxLength) : stringifyAndPrune(data, maxLength);

export const parseErrorObject = err => ({
  type: err && err.name,
  message: err && err.message,
  stacktrace: err && err.stack,
});

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

export const isAwsService = (host, responseData) => {
  if (host && host.includes('amazonaws.com')) {
    return true;
  }
  return !!(
    responseData &&
    responseData.headers &&
    (responseData.headers['x-amzn-requestid'] ||
      responseData.headers['x-amz-request-id'])
  );
};

export const removeLumigoFromStacktrace = handleReturnValue => {
  try {
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
  } catch (err) {
    logger.warn('Failed to remove Lumigo from stacktrace', err);
    return handleReturnValue;
  }
};

export const httpReq = (options = {}, reqBody) =>
  new Promise((resolve, reject) => {
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
  return getAwsEdgeHost();
};

export const spanHasErrors = span =>
  !!(
    span.error ||
    (span.info &&
      span.info.httpInfo &&
      span.info.httpInfo.response &&
      span.info.httpInfo.response.statusCode &&
      span.info.httpInfo.response.statusCode > 400)
  );

export const getEdgeUrl = () => {
  const host = getEdgeHost();
  const path = SPAN_PATH;
  return { host, path };
};

//Base64 calculation taken from : https://stackoverflow.com/questions/13378815/base64-length-calculation
export const getJSONBase64Size = obj => {
  return Math.ceil((Buffer.byteLength(JSON.stringify(obj), 'utf8') / 3) * 4);
};

export const parseQueryParams = queryParams => {
  if (typeof queryParams !== 'string') return {};
  let obj = {};
  queryParams.replace(/([^=&]+)=([^&]*)/g, function(m, key, value) {
    obj[decodeURIComponent(key)] = decodeURIComponent(value);
  });
  return obj;
};

const domainScrubbers = () =>
  JSON.parse(
    process.env.LUMIGO_DOMAINS_SCRUBBER || LUMIGO_DEFAULT_DOMAIN_SCRUBBERS
  ).map(x => new RegExp(x, 'i'));

export const shouldScrubDomain = url => {
  return !!url && domainScrubbers().some(regex => url.match(regex));
};

export const parseJsonFromEnvVar = (envVar, warnClient = false) => {
  try {
    return JSON.parse(process.env[envVar]);
  } catch (e) {
    warnClient && logger.warnClient(`${envVar} need to be a valid JSON`);
  }
  return undefined;
};

export const keyToOmitRegexes = () => {
  let regexesList = OMITTING_KEYS_REGEXES;
  if (process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP]) {
    const parseResponse = parseJsonFromEnvVar(
      LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
      true
    );
    if (parseResponse) {
      regexesList = parseResponse;
    }
  } else if (process.env[LUMIGO_SECRET_MASKING_REGEX]) {
    const parseResponse = parseJsonFromEnvVar(
      LUMIGO_SECRET_MASKING_REGEX,
      true
    );
    if (parseResponse) {
      regexesList = parseResponse;
    }
  }

  return regexesList.map(x => new RegExp(x, 'i'));
};

export const omitKeys = obj => {
  if (obj instanceof Array) {
    return obj.map(omitKeys);
  }
  if (typeof obj === 'string') {
    try {
      const parsedObject = JSON.parse(obj);
      return typeof parsedObject === 'object' ? omitKeys(parsedObject) : obj;
    } catch (e) {
      return obj;
    }
  }
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  obj = noCirculars(obj);
  const regexes = keyToOmitRegexes();
  return Object.keys(obj).reduce((newObj, key) => {
    if (SKIP_SCRUBBING_KEYS.includes(key)) {
      newObj[key] = obj[key];
    } else if (regexes.some(regex => regex.test(key))) {
      newObj[key] = '****';
    } else {
      newObj[key] = omitKeys(obj[key]);
    }
    return newObj;
  }, {});
};

export const safeExecute = (
  callback,
  message = 'Error in Lumigo tracer'
) => () => {
  try {
    return callback();
  } catch (err) {
    logger.warn(message, err);
  }
};

export const recursiveGetKey = (event, keyToSearch) => {
  return recursiveGetKeyByDepth(event, keyToSearch, recursiveGetKeyDepth());
};

const recursiveGetKeyDepth = () => {
  return parseInt(process.env[GET_KEY_DEPTH_ENV_KEY]) || DEFAULT_GET_KEY_DEPTH;
};

const recursiveGetKeyByDepth = (event, keyToSearch, maxDepth) => {
  if (maxDepth === 0) {
    return undefined;
  }
  let foundValue = undefined;
  const examineKey = k => {
    if (k === keyToSearch) {
      foundValue = event[k];
      return true;
    }
    if (event[k] && typeof event[k] === 'object') {
      foundValue = recursiveGetKeyByDepth(event[k], keyToSearch, maxDepth - 1);
      return foundValue !== undefined;
    }
  };
  Object.keys(event).some(examineKey);
  return foundValue;
};
