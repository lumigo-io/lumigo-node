import { Buffer } from 'buffer';
import {
  MAX_TRACER_ADDED_DURATION_ALLOWED,
  MIN_TRACER_ADDED_DURATION_ALLOWED,
  TracerGlobals,
} from './globals';
import { isAwsContext } from './guards/awsGuards';
import * as logger from './logger';
import { AwsEnvironment, ContextInfo, LambdaContext } from './types/aws/awsEnvironment';
import { EdgeUrl } from './types/common/edgeTypes';
import { CommonUtils } from '@lumigo/node-core';
import { runOneTimeWrapper } from './utils/functionUtils';

export const getRandomId = CommonUtils.getRandomId;
export const getRandomString = CommonUtils.getRandomString;
export const md5Hash = CommonUtils.md5Hash;
export const SPAN_PATH = '/api/spans';
export const LUMIGO_TRACER_EDGE = 'lumigo-tracer-edge.golumigo.com';
export const LUMIGO_DEFAULT_DOMAIN_SCRUBBERS =
  '["secretsmanager.*.amazonaws.com", "ssm.*.amazonaws.com", "kms.*.amazonaws.com", "sts..*amazonaws.com"]';
export const LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP = 'LUMIGO_BLACKLIST_REGEX';
export const LUMIGO_SECRET_MASKING_REGEX = 'LUMIGO_SECRET_MASKING_REGEX';
export const LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES =
  'LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES';
export const LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_HEADERS =
  'LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_HEADERS';
export const LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES =
  'LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES';
export const LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_HEADERS =
  'LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_HEADERS';
export const LUMIGO_SECRET_MASKING_REGEX_HTTP_QUERY_PARAMS =
  'LUMIGO_SECRET_MASKING_REGEX_HTTP_QUERY_PARAMS';
export const LUMIGO_SECRET_MASKING_REGEX_ENVIRONMENT = 'LUMIGO_SECRET_MASKING_REGEX_ENVIRONMENT';
export const LUMIGO_SECRET_MASKING_ALL_MAGIC = 'all';

export const LUMIGO_SECRET_MASKING_EXACT_PATH = 'LUMIGO_SECRET_MASKING_EXACT_PATH';
export const LUMIGO_WHITELIST_KEYS_REGEXES = 'LUMIGO_WHITELIST_KEYS_REGEXES';
export const LUMIGO_SUPPORT_LARGE_INVOCATIONS = 'LUMIGO_SUPPORT_LARGE_INVOCATIONS';
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
export const INVOCATION_ID_KEY = 'invocation_id';
export const TRANSACTION_ID_KEY = 'transaction_id';
export const SENDING_TIME_ID_KEY = 'sending_time';
export const DEFAULT_TIMEOUT_MIN_DURATION = 2000;
export const DEFAULT_CONNECTION_TIMEOUT = 300;
export const DEFAULT_AUTO_TAG_KEY = 'LUMIGO_AUTO_TAG';

const REQUEST_TIMEOUT_FLAG_MS = 'LUMIGO_REQUEST_TIMEOUT_MS';
export const getRequestTimeout = () => {
  if (process.env[REQUEST_TIMEOUT_FLAG_MS]) return parseInt(process.env[REQUEST_TIMEOUT_FLAG_MS]);
  return 300;
};

export const getContextInfo = (context: LambdaContext): ContextInfo => {
  const remainingTimeInMillis = context.getRemainingTimeInMillis();
  const { functionName, awsRequestId, invokedFunctionArn, callbackWaitsForEmptyEventLoop } =
    context;
  const awsAccountId = getAccountIdFromInvokedFunctinArn(invokedFunctionArn);

  return {
    functionName,
    awsRequestId,
    awsAccountId,
    remainingTimeInMillis,
    callbackWaitsForEmptyEventLoop,
  };
};

export const getAccountIdFromInvokedFunctinArn = (invokedFunctionArn: string): string =>
  invokedFunctionArn ? invokedFunctionArn.split(':')[4] : '';

export const getAccountId = (context: LambdaContext): string => {
  const { invokedFunctionArn } = context;
  return getAccountIdFromInvokedFunctinArn(invokedFunctionArn);
};

export const getTracerInfo = (): { name: string; version: string } => {
  const pkg = require('../package.json');
  const { name, version } = pkg;
  return { name, version };
};

export const getTraceId = (awsXAmznTraceId) => {
  try {
    if (!awsXAmznTraceId) {
      throw new Error('Missing _X_AMZN_TRACE_ID environment variable.');
    }

    const traceIdArr = awsXAmznTraceId.split(';');
    if (traceIdArr.length < 3) {
      throw new Error(
        'Expected 3 semi-colon separated parts in _X_AMZN_TRACE_ID environment variable.'
      );
    }

    const traceId = {};
    // XXX Populates Root, Parent and Sampled keys.
    traceIdArr.forEach((item) => {
      const [key, value] = item.split('=');
      traceId[key] = value;
    });

    if (!traceId['Root'] || !traceId['Sampled']) {
      throw new Error(
        `Either Root or Sampled tokens weren't found in the _X_AMZN_TRACE_ID environment variable.`
      );
    }
    if (!traceId['Parent']) {
      traceId['Parent'] = getRandomString(16);
    }

    // @ts-ignore
    traceId.transactionId = traceId.Root.split('-')[2];

    return traceId;
  } catch (err) {
    /*
     * Generate deterministic (as this method may be invoked multiple times during the same invocation)
     * transaction identifier based on the value of _X_AMZN_TRACE_ID or the invocation identifier
     */
    logger.warn(
      'Could not parse the value of the _X_AMZN_TRACE_ID environment variable (error is available in debug logs setting ' +
        "the LUMIGO_DEBUG environment variable to 'true'); the transaction in Lumigo may be incomplete"
    );
    logger.debug('Error while parsing the _X_AMZN_TRACE_ID environment variable:', err);

    var traceId = awsXAmznTraceId;
    if (!traceId) {
      // If we do not have the _X_AMZN_TRACE_ID environment variable, we use
      // the invocation identifier in the Lambda context
      const { context } = TracerGlobals.getHandlerInputs();
      traceId = context.awsRequestId;
    }
    if (!traceId) {
      // OK, what is going on here: not even the context invocationId?!?
      // Deperate times call for desperate measures: we accept the collision of trace IDs by
      // using _key_ of the _X_AMZN_TRACE_ID env var, not the value
      traceId = '_X_AMZN_TRACE_ID';
      logger.warn(
        'Could find neither the _X_AMZN_TRACE_ID environment variable, nor the invocation identifier in the context; ' +
          'using a static transaction ID that will cause unrelated transactions to be merged in Lumigo. Please contact Lumigo support.'
      );
    }

    var base64TraceId = Buffer.from(traceId).toString('hex');

    while (base64TraceId.length < 24) {
      base64TraceId += base64TraceId;
    }
    const root = base64TraceId.slice(1, 8);

    return {
      // Root is supposed to be 8 hexadecimal characters
      Root: root,
      // Root is supposed to be 24 hexadecimal characters
      Parent: base64TraceId.slice(0, 24),
      // We always sample :-)
      Sampled: '1',
      transactionId: base64TraceId.slice(0, 24),
    };
  }
};

export const getPatchedTraceId = (awsXAmznTraceId): string => {
  // @ts-ignore
  const { Root, Parent, Sampled, transactionId } = getTraceId(awsXAmznTraceId);
  const rootArr = Root.split('-');
  const currentTime = Math.floor(Date.now() / 1000).toString(16);
  return `Root=${rootArr[0]}-${currentTime}-${transactionId};Parent=${Parent};Sampled=${Sampled}`;
};

export const isPromise = (obj: any): boolean => typeof obj?.then === 'function';

export const getAWSEnvironment = (): AwsEnvironment => {
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
const WRAPPED_FLAG = 'LUMIGO_IS_WRAPPED';
const VERBOSE_FLAG = 'LUMIGO_VERBOSE';
const SEND_ONLY_IF_ERROR_FLAG = 'SEND_ONLY_IF_ERROR';
const PRUNE_TRACE_OFF_FLAG = 'LUMIGO_PRUNE_TRACE_OFF';
const STORE_LOGS_FLAG = 'LUMIGO_STORE_LOGS';
const TIMEOUT_BUFFER_FLAG = 'LUMIGO_TIMEOUT_BUFFER';
const TIMEOUT_MIN_DURATION = 'LUMIGO_TIMEOUT_MIN_DURATION';
const TIMEOUT_BUFFER_FLAG_MS = 'LUMIGO_TIMEOUT_BUFFER_MS';
const TRACER_TIMEOUT_FLAG = 'LUMIGO_TRACER_TIMEOUT';
const AGENT_KEEPALIVE = 'LUMIGO_AGENT_KEEPALIVE_MS';
const REUSE_CONNECTION = 'LUMIGO_REUSE_HTTP_CONNECTION';
const KEEP_HEADERS = 'LUMIGO_KEEP_HTTP_HEADERS';
const DEBUG_FLAG = 'LUMIGO_DEBUG';
const IS_STEP_FUNCTION_FLAG = 'LUMIGO_STEP_FUNCTION';
const SCRUB_KNOWN_SERVICES_FLAG = 'LUMIGO_SCRUB_KNOWN_SERVICES';
const LUMIGO_LOG_PREFIX = '[LUMIGO_LOG]';
const LUMIGO_LOG_PREFIX_FLAG = 'LUMIGO_LOG_PREFIX';
const LUMIGO_PROPAGATE_W3C = 'LUMIGO_PROPAGATE_W3C';
const LUMIGO_STACK_PATTERNS = [
  new RegExp('/dist/lumigo.js:', 'i'),
  new RegExp('/node_modules/@lumigo/tracer/', 'i'),
];

export const SWITCH_OFF_FLAG = 'LUMIGO_SWITCH_OFF';

const validateEnvVar = (envVar: string, value: string = 'TRUE'): boolean =>
  !!(process.env[envVar] && process.env[envVar].toUpperCase() === value.toUpperCase());

export const isAwsEnvironment = () =>
  !!(
    process.env['LAMBDA_RUNTIME_DIR'] &&
    !process.env['AWS_SAM_LOCAL'] && // local SAM
    !process.env['IS_LOCAL']
  ); // local SLS

export const getEnvVarAsList = (key: string, def: string[]): string[] => {
  if (process.env[key] != null) {
    return process.env[key].split(',');
  }
  return def;
};

export const safeGet = (obj, arr, dflt = null) => {
  let current = obj;
  for (const i in arr) {
    if (!current) {
      return dflt;
    }
    current = current[arr[i]];
  }
  return current || dflt;
};
/**
 * Finds a value from object with case-insensitive match of keys.
 * If multiple matching keys are found, the first is returned
 *
 * @param obj Object to get value from
 * @param key The key to search (can be upper / lower case or a mix of the two, it doesn't matter)
 * @param dflt Default value if no match is found
 */
export const caseInsensitiveGet = (obj: object, key: string, dflt: any = null) => {
  const lowerCaseKey = key.toLowerCase();
  const matchingKey = Object.keys(obj).find((k) => k.toLowerCase() === lowerCaseKey);
  return matchingKey ? obj[matchingKey] : dflt;
};

export const safeJsonParse = (obj, dflt = undefined) => {
  return safeExecute(
    () => JSON.parse(obj),
    'Failed to parse json',
    logger.LOG_LEVELS.DEBUG,
    dflt
  )();
};

export const isTimeoutTimerEnabled = (): boolean => !validateEnvVar(TIMEOUT_ENABLE_FLAG, 'FALSE');

export const getTimeoutTimerBuffer = (): number => {
  if (process.env[TIMEOUT_BUFFER_FLAG_MS]) return parseFloat(process.env[TIMEOUT_BUFFER_FLAG_MS]);
  if (process.env[TIMEOUT_BUFFER_FLAG]) return parseFloat(process.env[TIMEOUT_BUFFER_FLAG]) * 1000;
  const { context } = TracerGlobals.getHandlerInputs();
  // @ts-ignore
  const { remainingTimeInMillis } = getContextInfo(context);
  return Math.max(500, Math.min(remainingTimeInMillis / 10, 3000));
};

export const getTracerMaxDurationTimeout = (): number => {
  if (process.env[TRACER_TIMEOUT_FLAG]) return parseFloat(process.env[TRACER_TIMEOUT_FLAG]);
  const { context } = TracerGlobals.getHandlerInputs();
  if (isAwsContext(context)) {
    return Math.max(
      Math.min(TracerGlobals.getLambdaTimeout() / 5, MAX_TRACER_ADDED_DURATION_ALLOWED),
      MIN_TRACER_ADDED_DURATION_ALLOWED
    );
  }
  return MAX_TRACER_ADDED_DURATION_ALLOWED;
};

export const getAgentKeepAlive = () => {
  if (process.env[AGENT_KEEPALIVE]) return parseFloat(process.env[AGENT_KEEPALIVE]);
  return undefined;
};

export const getTimeoutMinDuration = () => {
  if (process.env[TIMEOUT_MIN_DURATION]) return parseFloat(process.env[TIMEOUT_MIN_DURATION]);
  return DEFAULT_TIMEOUT_MIN_DURATION;
};

export const isScrubKnownServicesOn = () => validateEnvVar(SCRUB_KNOWN_SERVICES_FLAG);

export const isVerboseMode = () => validateEnvVar(VERBOSE_FLAG);

export const isProvisionConcurrencyInitialization = () =>
  process.env.AWS_LAMBDA_INITIALIZATION_TYPE === 'provisioned-concurrency';

export const isWarm = (): boolean =>
  validateEnvVar(WARM_FLAG) || isProvisionConcurrencyInitialization();

export const isDebug = (): boolean =>
  validateEnvVar(DEBUG_FLAG) || TracerGlobals.getTracerInputs().debug;

export const isLambdaWrapped = (): boolean => validateEnvVar(WRAPPED_FLAG);

export const shouldPropagateW3C = (): boolean => !validateEnvVar(LUMIGO_PROPAGATE_W3C, 'FALSE');

export const shouldTryZip = (): boolean => validateEnvVar(LUMIGO_SUPPORT_LARGE_INVOCATIONS);

export const setLambdaWrapped = (): void => {
  process.env[WRAPPED_FLAG] = 'TRUE';
};

export const isStoreLogs = (): boolean => validateEnvVar(STORE_LOGS_FLAG);

export const isReuseHttpConnection = (): boolean => validateEnvVar(REUSE_CONNECTION);

export const isSendOnlyIfErrors = (): boolean => validateEnvVar(SEND_ONLY_IF_ERROR_FLAG);

export const isPruneTraceOff = (): boolean => validateEnvVar(PRUNE_TRACE_OFF_FLAG);

export const isKeepHeadersOn = (): boolean => validateEnvVar(KEEP_HEADERS);

export const isSwitchedOff = (): boolean =>
  safeExecute(
    () =>
      validateEnvVar(SWITCH_OFF_FLAG) ||
      TracerGlobals?.getTracerInputs()?.switchOff ||
      !isValidAlias()
  )();

export const isStepFunction = (): boolean =>
  validateEnvVar(IS_STEP_FUNCTION_FLAG) || TracerGlobals.getTracerInputs().isStepFunction;

export const getValidAliases = () =>
  safeExecute(() => {
    return JSON.parse(process.env['LUMIGO_VALID_ALIASES'] || '[]');
  })() || [];

export const getMaxRequestSize = () => TracerGlobals.getTracerInputs().maxSizeForRequest;
export const getMaxRequestSizeOnError = () =>
  TracerGlobals.getTracerInputs().maxSizeForRequestOnError;

export const getInvokedArn = () => {
  // @ts-ignore
  return TracerGlobals.getHandlerInputs().context.invokedFunctionArn || '';
};

export const getInvokedVersion = () => {
  // @ts-ignore
  return TracerGlobals.getHandlerInputs().context.functionVersion || '';
};

export const getInvokedAliasOrNull = () =>
  safeExecute(() => {
    return getInvokedArn().split(':').length >= 8 ? getInvokedArn().split(':')[7] : null;
  })() || null;

export const isValidAlias = () => {
  const validAliases = getValidAliases();
  const currentAlias = getInvokedAliasOrNull();
  const validAlias =
    !currentAlias || validAliases.length === 0 || validAliases.includes(currentAlias);
  if (!validAlias) {
    logger.debug(`Alias is invalid, alias: ${currentAlias}`);
  }
  return validAlias;
};

export const isValidToken = (token) => {
  const regex = /[t][_][a-z0-9]{15,100}/gm;
  const match = (token || '').match(regex);
  return match && token === match[0];
};

export const setWarm = () => (process.env[WARM_FLAG] = 'TRUE');

export const setSendOnlyIfErrors = () => (process.env[SEND_ONLY_IF_ERROR_FLAG] = 'TRUE');

export const setPruneTraceOff = () => (process.env[PRUNE_TRACE_OFF_FLAG] = 'TRUE');

export const setStoreLogsOn = () => (process.env[STORE_LOGS_FLAG] = 'TRUE');

export const setVerboseMode = () => (process.env[VERBOSE_FLAG] = 'TRUE');

export const setSwitchOff = () => (process.env['LUMIGO_SWITCH_OFF'] = 'TRUE');

export const setDebug = () => (process.env['LUMIGO_DEBUG'] = 'TRUE');

export const unsetDebug = () => (process.env['LUMIGO_DEBUG'] = undefined);

export const setTimeoutTimerDisabled = () => (process.env[TIMEOUT_ENABLE_FLAG] = 'FALSE');

export function isString(x: any): x is string {
  return Object.prototype.toString.call(x) === '[object String]';
}

export const DEFAULT_LUMIGO_MAX_ENTRY_SIZE = 2048;

export const getEventEntitySize = (hasError = false) => {
  const basicSize =
    parseInt(process.env['MAX_EVENT_ENTITY_SIZE']) ||
    parseInt(process.env['LUMIGO_MAX_ENTRY_SIZE']) ||
    DEFAULT_LUMIGO_MAX_ENTRY_SIZE;
  if (hasError) {
    return parseInt(process.env['LUMIGO_MAX_ENTRY_SIZE_ON_ERROR']) || basicSize * 2;
  }
  return basicSize;
};

export const getConnectionTimeout = () => {
  return parseInt(process.env['LUMIGO_CONNECTION_TIMEOUT']) || DEFAULT_CONNECTION_TIMEOUT;
};

export const getLogPrefix = () => {
  return process.env[LUMIGO_LOG_PREFIX_FLAG] || LUMIGO_LOG_PREFIX;
};

export const parseErrorObject = (err) => ({
  type: err && err.name,
  message: err && err.message,
  stacktrace: err && err.stack,
});

export function isObject(a: any): a is object {
  return !!a && a.constructor === Object;
}

export const lowerCaseObjectKeys = (o?: {}) =>
  o ? Object.keys(o).reduce((c, k) => ((c[k.toLowerCase()] = o[k]), c), {}) : {};

export const isAwsService = (host, responseData = undefined): boolean => {
  if (host && host.includes('amazonaws.com')) {
    return true;
  }
  return !!(
    responseData &&
    responseData.headers &&
    (responseData.headers['x-amzn-requestid'] || responseData.headers['x-amz-request-id'])
  );
};

const isLumigoStackTrace = (input) => {
  return LUMIGO_STACK_PATTERNS.some((word) => word.test(input));
};

export const removeLumigoFromStacktrace = (handleReturnValue) => {
  // Note: this function was copied to the auto-instrument-handler. Keep them both up to date.
  try {
    const { err, data, type } = handleReturnValue;
    if (!err || !err.stack) {
      return handleReturnValue;
    }
    const { stack } = err;
    const stackArr = stack.split('\n');

    const cleanedStack = stackArr.filter((v) => !isLumigoStackTrace(v));

    err.stack = cleanedStack.join('\n');

    return { err, data, type };
  } catch (err) {
    logger.warn('Failed to remove Lumigo from stacktrace', err);
    return handleReturnValue;
  }
};

export const getAwsEdgeHost = (): string => {
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

export const spanHasErrors = (span) =>
  !!(
    span.error ||
    (span.info &&
      span.info.httpInfo &&
      span.info.httpInfo.response &&
      span.info.httpInfo.response.statusCode &&
      span.info.httpInfo.response.statusCode >= 400)
  );

export const getEdgeUrl = (): EdgeUrl => {
  const host = getEdgeHost();
  const path = SPAN_PATH;
  const url = `https://${host}${path}`;
  return { host, path, url };
};

//Base64 calculation taken from : https://stackoverflow.com/questions/13378815/base64-length-calculation
export const getJSONBase64Size = (obj) => {
  return Math.ceil((Buffer.byteLength(JSON.stringify(obj), 'utf8') / 3) * 4);
};

export const parseQueryParams = (queryParams) => {
  return safeExecute(
    () => {
      if (typeof queryParams !== 'string') return {};
      const obj = {};
      queryParams.replace(
        /([^=&]+)=([^&]*)/g,
        // @ts-ignore
        safeExecute(
          (m, key, value) => {
            obj[decodeURIComponent(key)] = decodeURIComponent(value);
          },
          'Failed to parse a specific key in parseQueryParams',
          logger.LOG_LEVELS.DEBUG
        )
      );
      return obj;
    },
    'Failed to parse query params',
    logger.LOG_LEVELS.WARNING,
    {}
  )();
};

const domainScrubbers = () =>
  JSON.parse(process.env.LUMIGO_DOMAINS_SCRUBBER || LUMIGO_DEFAULT_DOMAIN_SCRUBBERS).map(
    (x) => new RegExp(x, 'i')
  );

export const shouldScrubDomain = (url, domains = domainScrubbers()): boolean => {
  return !!url && domains.some((regex) => url.match(regex));
};

export const parseJsonFromEnvVar = (envVar, warnClient = false): {} | undefined => {
  try {
    return JSON.parse(process.env[envVar]);
  } catch (e) {
    warnClient && logger.warnClient(`${envVar} need to be a valid JSON`);
  }
  return undefined;
};

export function safeExecute<T>(
  callback: Function,
  message: string = 'Error in Lumigo tracer',
  logLevel: string = logger.LOG_LEVELS.WARNING,
  defaultReturn: T = undefined
): Function {
  return function (...args) {
    try {
      return callback.apply(this, args);
    } catch (err) {
      logger.log(logLevel, message, err);
      return defaultReturn;
    }
  };
}

export const recursiveGetKey = (event, keyToSearch) => {
  return recursiveGetKeyByDepth(event, keyToSearch, recursiveGetKeyDepth());
};

const recursiveGetKeyDepth = (): number => {
  return parseInt(process.env[GET_KEY_DEPTH_ENV_KEY]) || DEFAULT_GET_KEY_DEPTH;
};

const recursiveGetKeyByDepth = (event, keyToSearch, maxDepth) => {
  if (maxDepth === 0) {
    return undefined;
  }
  let foundValue = undefined;
  const examineKey = (k) => {
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

export const isEncodingType = (encodingType): boolean =>
  !!(
    encodingType &&
    typeof encodingType === 'string' &&
    ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex'].includes(encodingType)
  );

export const isEmptyString = (str): boolean =>
  !!(!str || (typeof str === 'string' && str.length === 0));

// @ts-ignore
export const removeDuplicates = (arr) => Array.from(new Set(arr));

export const getAutoTagKeys = (): string[] =>
  safeExecute(() => {
    return (process.env.LUMIGO_AUTO_TAG || DEFAULT_AUTO_TAG_KEY).split(',');
  })() || [DEFAULT_AUTO_TAG_KEY];

export const filterObjectKeys = (
  obj: object,
  filterFunc: (value: string, index?: number, array?: any[]) => boolean
): object =>
  Object.keys(obj)
    .filter(filterFunc)
    .reduce((cur, key) => {
      return Object.assign(cur, { [key]: obj[key] });
    }, {});

export const isLambdaTraced = () => isAwsEnvironment() && !isSwitchedOff();
export const getRequestBodyMaskingRegex = (): string | undefined =>
  process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES];
export const getRequestHeadersMaskingRegex = (): string | undefined =>
  process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_HEADERS];
export const getResponseBodyMaskingRegex = (): string | undefined =>
  process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES];
export const getResponseHeadersMaskingRegex = (): string | undefined =>
  process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_HEADERS];
export const getEnvVarsMaskingRegex = (): string | undefined =>
  process.env[LUMIGO_SECRET_MASKING_REGEX_ENVIRONMENT];
export const getHttpQueryParamsMaskingRegex = (): string | undefined =>
  process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_QUERY_PARAMS];

export const getSecretMaskingExactPath = (): string | undefined =>
  process.env[LUMIGO_SECRET_MASKING_EXACT_PATH];

const invalidMaskingExactPathWarning = runOneTimeWrapper((e) => {
  logger.warn('Failed to parse the given masking exact path', e);
});

export const getSecretPaths = (): string[] => {
  let secretPaths = [];
  try {
    secretPaths = JSON.parse(getSecretMaskingExactPath());
  } catch (e) {
    invalidMaskingExactPathWarning(e);
  }
  return secretPaths;
};
