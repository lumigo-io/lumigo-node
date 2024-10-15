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
  LUMIGO_SECRET_MASKING_DEBUG,
  OMITTING_KEYS_REGEXES,
  parseJsonFromEnvVar,
  safeExecute,
  BYPASS_MASKING_KEYS,
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
  logSecretMaskingDebug(logger, 'Getting key to omit regexes', {
    regexesList,
    backwardCompRegexEnvVarName,
    regexesEnvVarName,
  });
  const fallbackRegexesList = regexesList;

  const tryParseEnvVar = (envVarName) => {
    if (process.env[envVarName]) {
      return parseJsonFromEnvVar(envVarName, true);
    }
    return null;
  };

  // Try parsing backward compatibility or main environment variables
  const regexes =
    tryParseEnvVar(backwardCompRegexEnvVarName) || tryParseEnvVar(regexesEnvVarName) || regexesList;

  try {
    return regexes.map((x) => new RegExp(x, 'i'));
  } catch (e) {
    invalidMaskingRegexWarning(e);
    logger.warn('Fallback to default regexes list', { fallbackRegexesList });
    return fallbackRegexesList.map((x) => new RegExp(x, 'i'));
  }
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

function scrubJsonStringBySecretPath(input, secretPaths, uniquePaths, currentPath) {
  try {
    let realJson = JSON.parse(input);
    const res = innerPathScrubbing(realJson, secretPaths, uniquePaths, currentPath);
    return JSON.stringify(res);
  } catch (e) {
    logger.debug('Failed to parse json payload for path scrubbing', { error: e, event: input });
    return input;
  }
}

function scrubJsonBySecretPath(input, secretPaths, uniquePaths, currentPath) {
  return innerPathScrubbing(input, secretPaths, uniquePaths, currentPath);
}

function getUniqPaths(paths) {
  let allPathKeys = [];
  paths.forEach((path) => {
    let keys = path.split('.');
    allPathKeys = [...allPathKeys, ...keys];
  });
  return allPathKeys.filter((x, i) => i === allPathKeys.indexOf(x));
}

function keyExistsInPaths(paths, key) {
  logger.debug(`Checking if key ${key} exists in ${paths}`);
  return paths.includes(key);
}

function innerPathScrubbing(input, secretPaths, uniquePaths, currentPath) {
  if (Array.isArray(input)) {
    input.forEach((item) => {
      input[item] = scrubJsonBySecretPath(item, secretPaths, uniquePaths, currentPath);
    });
    return input;
  }
  if (isString(input)) {
    return input;
  } else {
    for (const key of Object.keys(input)) {
      if (!keyExistsInPaths(uniquePaths, key)) {
        continue;
      }
      const newPath = currentPath ? currentPath + '.' + key : key;
      if (secretPaths.includes(newPath)) {
        input[key] = SCRUBBED_TEXT;
        continue;
      }
      currentPath = newPath;
      if (isString(input[key])) {
        input[key] = scrubJsonStringBySecretPath(input[key], secretPaths, uniquePaths, currentPath);
      } else {
        input[key] = scrubJsonBySecretPath(input[key], secretPaths, uniquePaths, currentPath);
      }
    }
  }
  return input;
}

function logSecretMaskingDebug(logger, message, additionalData) {
  if (process.env[LUMIGO_SECRET_MASKING_DEBUG]) {
    if (additionalData) {
      logger.debug(message, additionalData);
    } else {
      logger.debug(message);
    }
  }
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
      const uniquePaths = getUniqPaths(secretPaths);
      if (isString(payload)) {
        payload = safeExecute(
          scrubJsonStringBySecretPath,
          FAILED_SCRUBBING_BY_PATH,
          logger.LOG_LEVELS.DEBUG,
          payload
        )(payload, secretPaths, uniquePaths, '');
      } else {
        payload = safeExecute(
          scrubJsonBySecretPath,
          FAILED_SCRUBBING_BY_PATH,
          logger.LOG_LEVELS.DEBUG,
          payload
        )(payload, secretPaths, uniquePaths, '');
      }
    }
  }

  let result = JSON.stringify(payload, function (key, value) {
    const type = typeof value;
    const isObj = type === 'object';
    const isStr = type === 'string';
    const isBigInt = type === 'bigint';

    if (isBigInt) {
      return value.toString();
    }

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
  logSecretMaskingDebug(logger, 'Shallow masking payload by regexes', {
    payloadKeys: Object.keys(payload),
    regexes,
  });
  regexes = regexes || keyToOmitRegexes();
  if (isString(payload)) {
    logSecretMaskingDebug(logger, 'Shallow masking string payload');
    return payload;
  }
  if (typeof payload !== 'object') {
    logger.warn('Failed to mask payload, payload is not an object or string', payload);
    return payload;
  }
  return Object.keys(payload).reduce((acc, key) => {
    if (BYPASS_MASKING_KEYS.includes(key)) {
      logSecretMaskingDebug(logger, 'Skipping masking of a Lumigo env-var', key);
      acc[key] = payload[key];
    } else if (keyContainsRegex(regexes, key)) {
      logSecretMaskingDebug(logger, 'Shallow masking key', key);
      acc[key] = SCRUBBED_TEXT;
    } else {
      acc[key] = payload[key];
    }
    return acc;
  }, {});
};

export const shallowMask = (context, payload) => {
  logSecretMaskingDebug(logger, 'Shallow masking payload', {
    context,
    payloadKeys: Object.keys(payload),
  });
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
    logSecretMaskingDebug(logger, 'Shallow masking payload with LUMIGO_SECRET_MASKING_ALL_MAGIC');
    return SCRUBBED_TEXT;
  } else if (givenSecretRegexes) {
    logSecretMaskingDebug(logger, 'Shallow masking payload with given regexes', {
      givenSecretRegexes,
    });
    try {
      givenSecretRegexes = JSON.parse(givenSecretRegexes);
      logSecretMaskingDebug(logger, 'Parsed given regexes', { givenSecretRegexes });
      givenSecretRegexes = givenSecretRegexes.map((x) => new RegExp(x, 'i'));
    } catch (e) {
      invalidMaskingRegexWarning(e);
      givenSecretRegexes = null;
    }
  }

  return shallowMaskByRegex(payload, givenSecretRegexes);
};
