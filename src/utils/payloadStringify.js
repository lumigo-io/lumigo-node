import * as logger from '../logger';
import {
  getEnvVarsMaskingRegex,
  getEventEntitySize,
  getHttpQueryParamsMaskingRegex,
  getRequestBodyMaskingRegex,
  getRequestHeadersMaskingRegex,
  getResponseBodyMaskingRegex,
  getResponseHeadersMaskingRegex,
  getSecretMaskingExactPath,
  getSecretPaths,
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
const FAILED_SCRUBBING_BY_PATH = 'Failed to scrub payload by exact path';

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

function scrubJsonStringBySecretPath(input, requestedPath, currentPath) {
  try {
    let realJson = JSON.parse(input);
    const res = innerPathScrubbing(realJson, requestedPath, currentPath);
    return JSON.stringify(res);
  } catch (e) {
    logger.debug('Failed to parse json payload for path scrubbing', { error: e, event: input });
    return innerPathScrubbing(input, requestedPath, currentPath);
  }
}

function scrubJsonBySecretPath(input, secretPaths, currentPath) {
  return innerPathScrubbing(input, secretPaths, currentPath);
}

function keyExistsInPaths(paths, key) {
  let allPathKeys = [];
  paths.forEach((path) => {
    let keys = path.split('.');
    allPathKeys = [...allPathKeys, ...keys];
  });
  const uniquePaths = allPathKeys.filter((x, i) => i === allPathKeys.indexOf(x));
  logger.debug(`Checking if key ${key} exists in ${uniquePaths}`);
  return uniquePaths.includes(key);
}

function innerPathScrubbing(input, secretPaths, currentPath) {
  if (Array.isArray(input)) {
    input.forEach((item) => {
      scrubJsonBySecretPath(item, secretPaths, currentPath);
    });
  }
  if (isString(input)) {
    return input;
  } else {
    for (const key of Object.keys(input)) {
      if (!keyExistsInPaths(secretPaths, key)) {
        continue;
      }
      const newPath = currentPath ? currentPath + '.' + key : key;
      if (secretPaths.includes(newPath)) {
        input[key] = SCRUBBED_TEXT;
        continue;
      }
      currentPath = newPath;
      if (isString(input[key])) {
        input[key] = scrubJsonStringBySecretPath(input[key], secretPaths, currentPath);
      } else {
        input[key] = scrubJsonBySecretPath(input[key], secretPaths, currentPath);
      }
    }
  }
  return input;
}

export const payloadStringify = (
  payload,
  maxPayloadSize = getEventEntitySize(),
  skipScrubPath = null,
  truncated = false
) => {
  let totalSize = 0;
  let refsFound = [];
  const secretsRegexes = keyToOmitRegexes();
  const whitelistRegexes = whitelistKeysRegexes();
  const secretItemsToSkipScrubbing = new Set(getItemsInPath(payload, skipScrubPath));

  let isPruned = false;

  if (getSecretMaskingExactPath()) {
    let secretPaths = getSecretPaths();
    if (secretPaths.length > 0) {
      if (isString(payload)) {
        payload = safeExecute(
          scrubJsonStringBySecretPath,
          FAILED_SCRUBBING_BY_PATH,
          logger.LOG_LEVELS.DEBUG,
          payload
        )(payload, secretPaths, '');
      } else {
        payload = safeExecute(
          scrubJsonBySecretPath,
          FAILED_SCRUBBING_BY_PATH,
          logger.LOG_LEVELS.DEBUG,
          payload
        )(payload, secretPaths, '');
      }
    }
  }

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

const shallowMaskByRegex = (payload, regexes) => {
  regexes = regexes || keyToOmitRegexes();
  if (isString(payload)) {
    return payload;
  }
  if (typeof payload !== 'object') {
    logger.warn('Failed to mask payload, payload is not an object or string', payload);
    return payload;
  }
  return Object.keys(payload).reduce((acc, key) => {
    if (keyContainsRegex(regexes, key)) {
      acc[key] = SCRUBBED_TEXT;
    } else {
      acc[key] = payload[key];
    }
    return acc;
  }, {});
};

export const shallowMask = (context, payload) => {
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
  } else if (context === 'queryParams') {
    givenSecretRegexes = getHttpQueryParamsMaskingRegex();
  } else {
    logger.warn('Unknown context for shallowMask', context);
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

  return shallowMaskByRegex(payload, givenSecretRegexes);
};
