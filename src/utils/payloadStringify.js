import * as logger from '../logger';
import {
  getEnvVarsMaskingRegex,
  getEventEntitySize,
  getRequestBodyMaskingRegex,
  getRequestHeadersMaskingRegex,
  getResponseBodyMaskingRegex,
  getResponseHeadersMaskingRegex,
  isString,
  LUMIGO_SECRET_MASKING_ALL_MAGIC,
  LUMIGO_SECRET_MASKING_REGEX,
  LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  LUMIGO_WHITELIST_KEYS_REGEXES,
  OMITTING_KEYS_REGEXES,
  parseJsonFromEnvVar,
  safeExecute,
} from '../utils';
import { runOneTimeWrapper } from './functionUtils';

const nativeTypes = ['string', 'bigint', 'number', 'undefined', 'boolean'];
const SCRUBBED_TEXT = '****';
const TRUNCATED_TEXT = '...[too long]';

const isNativeType = (obj) => nativeTypes.includes(typeof obj);

const keyToRegexes = (
  regexesList = OMITTING_KEYS_REGEXES,
  backwardCompRegexEnvVarName = LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  regexesEnvVarName = LUMIGO_SECRET_MASKING_REGEX
) => {
  if (process.env[backwardCompRegexEnvVarName]) {
    const parseResponse = parseJsonFromEnvVar(backwardCompRegexEnvVarName, true);
    if (parseResponse) {
      regexesList = parseResponse;
    }
  } else if (process.env[regexesEnvVarName]) {
    const parseResponse = parseJsonFromEnvVar(regexesEnvVarName, true);
    if (parseResponse) {
      regexesList = parseResponse;
    }
  }
  return regexesList.map((x) => new RegExp(x, 'i'));
};

export const keyToOmitRegexes = () => {
  return keyToRegexes();
};

export const whitelistKeysRegexes = () => {
  return keyToRegexes([], null, LUMIGO_WHITELIST_KEYS_REGEXES);
};

export const truncate = (str, maxLength, truncationString = '') => {
  let toTruncate = str;
  if (!isString(toTruncate)) {
    logger.warn('Truncate was called on a non-string object', toTruncate);
    toTruncate = '';
  }
  return toTruncate.substr(0, maxLength - truncationString.length).concat(truncationString);
};

const keyContainsRegex = (regexes, key) => {
  if (!isNaN(key)) {
    //optimization for arrays
    return false;
  }
  return !!regexes.some((regex) => regex.test(key));
};

//Base64 calculation taken from : https://stackoverflow.com/questions/13378815/base64-length-calculation
const getNativeVarSize = (obj) => (obj ? (obj.toString().length * 4) / 3 : 0);

const getItemsInPath = safeExecute(
  (payload, path) => {
    if (!payload || !path) {
      return [];
    }
    if (Array.isArray(path[0]) && Array.isArray(payload)) {
      const newPath = path.slice(1);
      return [].concat(...payload.map((i) => getItemsInPath(i, newPath)));
    } else if (payload[path[0]]) {
      if (path.length === 1) {
        return [payload];
      }
      return getItemsInPath(payload[path[0]], path.slice(1));
    }
    return [];
  },
  'Failed to find items to skip scrubbing',
  logger.LOG_LEVELS.WARNING,
  []
);

export const payloadStringify = (
  payload,
  maxPayloadSize = getEventEntitySize(),
  skipScrubPath = null,
  truncated = false,
  givenSecretRegexes = null
) => {
  let totalSize = 0;
  let refsFound = [];
  const secretsRegexes = givenSecretRegexes || keyToOmitRegexes();
  const whitelistRegexes = whitelistKeysRegexes();
  const secretItemsToSkipScrubbing = new Set(getItemsInPath(payload, skipScrubPath));

  let isPruned = false;
  let result = JSON.stringify(payload, function (key, value) {
    const type = typeof value;
    const isObj = type === 'object';
    const isStr = type === 'string';
    const shouldSkipSecretScrub =
      skipScrubPath &&
      skipScrubPath[skipScrubPath.length - 1] === key &&
      secretItemsToSkipScrubbing.has(this);
    if (!(isObj && refsFound.includes(value))) {
      if (totalSize < maxPayloadSize) {
        if (
          !shouldSkipSecretScrub &&
          !keyContainsRegex(whitelistRegexes, key) &&
          keyContainsRegex(secretsRegexes, key)
        ) {
          return SCRUBBED_TEXT;
        }
        if (isNativeType(value)) {
          totalSize += getNativeVarSize(value);
        }
        if (isObj) {
          refsFound.push(value);
        }
        if (value && isStr && value.length > maxPayloadSize) {
          isPruned = true;
          return truncate(value, maxPayloadSize);
        }
        if (value instanceof Error) {
          return {
            message: value.message,
            stack: truncate(value.stack, maxPayloadSize, TRUNCATED_TEXT),
          };
        }
        return value;
      } else isPruned = true;
    } else {
      isPruned = true;
    }
  });
  if (result && (isPruned || truncated)) {
    result = result.replace(/,null/g, '');
    if (!(payload instanceof Error)) {
      result = result.concat(TRUNCATED_TEXT);
    }
  }
  return result || '';
};

const invalidMaskingRegexWarning = runOneTimeWrapper((e) => {
  logger.warn('Failed to parse the given masking regex', e);
});

export const payloadStringifyWithContext = (
  context,
  payload,
  maxPayloadSize = getEventEntitySize(),
  skipScrubPath = null,
  truncated = false
) => {
  let givenSecretRegexes = null;
  if (context === 'environment') {
    givenSecretRegexes = getEnvVarsMaskingRegex();
  } else if (context === 'requestBody') {
    givenSecretRegexes = getRequestBodyMaskingRegex();
  } else if (context === 'requestHeaders') {
    givenSecretRegexes = getRequestHeadersMaskingRegex();
  } else if (context === 'responseBody') {
    givenSecretRegexes = getResponseBodyMaskingRegex();
  } else if (context === 'responseHeaders') {
    givenSecretRegexes = getResponseHeadersMaskingRegex();
  }

  if (givenSecretRegexes === LUMIGO_SECRET_MASKING_ALL_MAGIC) {
    return SCRUBBED_TEXT;
  } else if (givenSecretRegexes) {
    try {
      givenSecretRegexes = JSON.parse(givenSecretRegexes);
      givenSecretRegexes = givenSecretRegexes.map((x) => new RegExp(x, 'i'));
    } catch (e) {
      invalidMaskingRegexWarning(e);
      givenSecretRegexes = null;
    }
  }

  if (isString(payload)) {
    return payload.length > maxPayloadSize ? truncate(payload, maxPayloadSize) : payload;
  }

  return payloadStringify(payload, maxPayloadSize, skipScrubPath, truncated, givenSecretRegexes);
};
