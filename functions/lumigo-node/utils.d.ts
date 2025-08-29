import { AwsEnvironment, ContextInfo, LambdaContext } from './types/aws/awsEnvironment';
import { EdgeUrl } from './types/common/edgeTypes';
type xRayTraceIdFields = {
    Root: String;
    transactionId: String;
    Parent: String;
    Sampled?: String;
    Lineage?: String;
};
export declare const getRandomId: () => string;
export declare const getRandomString: (evenNrChars: any) => string;
export declare const md5Hash: (item: {}) => string | undefined;
export declare const SPAN_PATH = "/api/spans";
export declare const LUMIGO_TRACER_EDGE = "lumigo-tracer-edge.golumigo.com";
export declare const LUMIGO_DEFAULT_DOMAIN_SCRUBBERS = "[\"secretsmanager.*.amazonaws.com\", \"ssm.*.amazonaws.com\", \"kms.*.amazonaws.com\", \"sts..*amazonaws.com\"]";
export declare const LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP = "LUMIGO_BLACKLIST_REGEX";
export declare const LUMIGO_SECRET_MASKING_REGEX = "LUMIGO_SECRET_MASKING_REGEX";
export declare const LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES = "LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES";
export declare const LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_HEADERS = "LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_HEADERS";
export declare const LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES = "LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES";
export declare const LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_HEADERS = "LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_HEADERS";
export declare const LUMIGO_SECRET_MASKING_REGEX_HTTP_QUERY_PARAMS = "LUMIGO_SECRET_MASKING_REGEX_HTTP_QUERY_PARAMS";
export declare const LUMIGO_SECRET_MASKING_REGEX_ENVIRONMENT = "LUMIGO_SECRET_MASKING_REGEX_ENVIRONMENT";
export declare const LUMIGO_SECRET_MASKING_ALL_MAGIC = "all";
export declare const LUMIGO_SECRET_MASKING_DEBUG = "LUMIGO_SECRET_MASKING_DEBUG";
export declare const LUMIGO_SECRET_MASKING_EXACT_PATH = "LUMIGO_SECRET_MASKING_EXACT_PATH";
export declare const LUMIGO_WHITELIST_KEYS_REGEXES = "LUMIGO_WHITELIST_KEYS_REGEXES";
export declare const LUMIGO_SUPPORT_LARGE_INVOCATIONS = "LUMIGO_SUPPORT_LARGE_INVOCATIONS";
export declare const LUMIGO_STORED_SPANS_MAX_SIZE_BYTES_ENV_VAR = "LUMIGO_STORED_SPANS_MAX_SIZE_BYTES";
export declare const OMITTING_KEYS_REGEXES: string[];
export declare const BYPASS_MASKING_KEYS: string[];
export declare const LUMIGO_EVENT_KEY = "_lumigo";
export declare const STEP_FUNCTION_UID_KEY = "step_function_uid";
export declare const GET_KEY_DEPTH_ENV_KEY = "LUMIGO_KEY_DEPTH";
export declare const DEFAULT_GET_KEY_DEPTH = 3;
export declare const EXECUTION_TAGS_KEY = "lumigo_execution_tags_no_scrub";
export declare const INVOCATION_ID_KEY = "invocation_id";
export declare const TRANSACTION_ID_KEY = "transaction_id";
export declare const SENDING_TIME_ID_KEY = "sending_time";
export declare const DEFAULT_TIMEOUT_MIN_DURATION = 2000;
export declare const DEFAULT_CONNECTION_TIMEOUT = 300;
export declare const DEFAULT_AUTO_TAG_KEY = "LUMIGO_AUTO_TAG";
export declare const getRequestTimeout: () => number;
export declare const getContextInfo: (context: LambdaContext) => ContextInfo;
export declare const getAccountIdFromInvokedFunctinArn: (invokedFunctionArn: string) => string;
export declare const getAccountId: (context: LambdaContext) => string;
export declare const getTracerInfo: () => {
    name: string;
    version: string;
};
export declare const splitXrayTraceIdToFields: (awsXAmznTraceId: string, maxFields?: number) => {
    [key: string]: string;
};
export declare const getNewFormatTraceId: (awsXAmznTraceId: string) => xRayTraceIdFields;
export declare const getTraceId: (awsXAmznTraceId: any) => {};
export declare const getPatchedTraceId: (awsXAmznTraceId: any) => string;
export declare const isPromise: (obj: any) => boolean;
export declare const getAWSEnvironment: () => AwsEnvironment;
export declare const TRACER_TIMEOUT_FLAG = "LUMIGO_TRACER_TIMEOUT";
export declare const SWITCH_OFF_FLAG = "LUMIGO_SWITCH_OFF";
export declare const isAwsEnvironment: () => boolean;
export declare const getEnvVarAsList: (key: string, def: string[]) => string[];
export declare const safeGet: (obj: any, arr: any, dflt?: any) => any;
/**
 * Finds a value from object with case-insensitive match of keys.
 * If multiple matching keys are found, the first is returned
 *
 * @param obj Object to get value from
 * @param key The key to search (can be upper / lower case or a mix of the two, it doesn't matter)
 * @param dflt Default value if no match is found
 */
export declare const caseInsensitiveGet: (obj: object, key: string, dflt?: any) => any;
export declare const safeJsonParse: (obj: any, dflt?: any) => any;
export declare const isTimeoutTimerEnabled: () => boolean;
export declare const getTimeoutTimerBuffer: () => number;
export declare const getTracerMaxDurationTimeout: () => number;
export declare const getAgentKeepAlive: () => number;
export declare const getTimeoutMinDuration: () => number;
export declare const isScrubKnownServicesOn: () => boolean;
export declare const isVerboseMode: () => boolean;
export declare const isProvisionConcurrencyInitialization: () => boolean;
export declare const isWarm: () => boolean;
export declare const isDebug: () => boolean;
export declare const isSecretMaskingDebug: () => boolean;
export declare const isLambdaWrapped: () => boolean;
export declare const shouldPropagateW3C: () => boolean;
export declare const setLambdaWrapped: () => void;
export declare const isStoreLogs: () => boolean;
export declare const isReuseHttpConnection: () => boolean;
export declare const isSendOnlyIfErrors: () => boolean;
export declare const isPruneTraceOff: () => boolean;
export declare const isKeepHeadersOn: () => boolean;
export declare const isSwitchedOff: () => boolean;
export declare const isStepFunction: () => boolean;
export declare const getValidAliases: () => any;
export declare const getMaxRequestSize: () => number;
export declare const getMaxRequestSizeOnError: () => number;
export declare const getInvokedArn: () => any;
export declare const getInvokedVersion: () => any;
export declare const getInvokedAliasOrNull: () => any;
export declare const isValidAlias: () => any;
export declare const isValidToken: (token: any) => boolean;
export declare const setWarm: () => string;
export declare const setSendOnlyIfErrors: () => string;
export declare const setPruneTraceOff: () => string;
export declare const setStoreLogsOn: () => string;
export declare const setVerboseMode: () => string;
export declare const setSwitchOff: () => string;
export declare const setDebug: () => string;
export declare const setSecretMaskingDebug: () => string;
export declare const unsetDebug: () => any;
export declare const setTimeoutTimerDisabled: () => string;
export declare function isString(x: any): x is string;
export declare const DEFAULT_LUMIGO_MAX_ENTRY_SIZE = 2048;
export declare const getEventEntitySize: (hasError?: boolean) => number;
export declare const getConnectionTimeout: () => number;
export declare const getLogPrefix: () => string;
export declare const parseErrorObject: (err: any) => {
    type: any;
    message: any;
    stacktrace: any;
};
export declare function isObject(a: any): a is object;
export declare const lowerCaseObjectKeys: (o?: {}) => {};
export declare const isAwsService: (host: any, responseData?: any) => boolean;
export declare const removeLumigoFromError: (stacktrace: string) => string;
export declare const removeLumigoFromStacktrace: (handleReturnValue: any) => any;
export declare const getAwsEdgeHost: () => string;
export declare const addHeaders: (currentHeaders: any, headersToAssign: any) => any;
export declare const getEdgeHost: () => string;
export declare const spanHasErrors: (span: any) => boolean;
export declare const getEdgeUrl: () => EdgeUrl;
export declare const getJSONBase64Size: (obj: any) => number;
export declare const parseQueryParams: (queryParams: any) => any;
export declare const shouldScrubDomain: (url: any, domains?: any) => boolean;
export declare const parseJsonFromEnvVar: (envVar: any, warnClient?: boolean) => {} | undefined;
export declare function safeExecute<T>(callback: Function, message?: string, logLevel?: string, defaultReturn?: T): Function;
export declare function safeExecuteAsync({ fn, message, logLevel, defaultReturn, }: {
    fn: Function;
    message?: string;
    logLevel?: string;
    defaultReturn?: any;
}): (...args: any[]) => Promise<any>;
export declare const recursiveGetKey: (event: any, keyToSearch: any) => any;
export declare const isEncodingType: (encodingType: any) => boolean;
export declare const isEmptyString: (str: any) => boolean;
export declare const removeDuplicates: (arr: any) => unknown[];
export declare const getAutoTagKeys: () => string[];
export declare const filterObjectKeys: (obj: object, filterFunc: (value: string, index?: number, array?: any[]) => boolean) => object;
export declare const shouldTryZip: () => boolean;
/**
 * The maximum size of all spans stored in memory before sending them to lumigo.
 * This limit is in place to prevent storing too many spans in memory and causing OOM errors.
 * Note: when the invocation ends and the spans are processed before sending to Lumigo, more processing and truncating
 * might take place
 * @returns number maximum size in bytes
 */
export declare const getMaxSizeForStoredSpansInMemory: () => number;
export declare const isLambdaTraced: () => boolean;
export declare const getRequestBodyMaskingRegex: () => string | undefined;
export declare const getRequestHeadersMaskingRegex: () => string | undefined;
export declare const getResponseBodyMaskingRegex: () => string | undefined;
export declare const getResponseHeadersMaskingRegex: () => string | undefined;
export declare const getEnvVarsMaskingRegex: () => string | undefined;
export declare const getHttpQueryParamsMaskingRegex: () => string | undefined;
export declare const getSecretMaskingExactPath: () => string | undefined;
export declare const getSecretPaths: () => string[];
export {};
