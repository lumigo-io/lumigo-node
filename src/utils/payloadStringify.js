import {
  getEventEntitySize,
  LUMIGO_SECRET_MASKING_REGEX,
  LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  OMITTING_KEYS_REGEXES,
  parseJsonFromEnvVar,
  isString,
} from '../utils';
import { safeExecute } from '../utils';
import * as logger from '../logger';

const nativeTypes = ['string', 'bigint', 'number', 'undefined', 'boolean'];
const SCRUBBED_TEXT = '****';
const TRUNCATED_TEXT = '...[too long]';

const isNativeType = (obj) => nativeTypes.includes(typeof obj);

export const keyToOmitRegexes = () => {
  let regexesList = OMITTING_KEYS_REGEXES;
  if (process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP]) {
    const parseResponse = parseJsonFromEnvVar(LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP, true);
    if (parseResponse) {
      regexesList = parseResponse;
    }
  } else if (process.env[LUMIGO_SECRET_MASKING_REGEX]) {
    const parseResponse = parseJsonFromEnvVar(LUMIGO_SECRET_MASKING_REGEX, true);
    if (parseResponse) {
      regexesList = parseResponse;
    }
  }
  return regexesList.map((x) => new RegExp(x, 'i'));
};

export const prune = (str, maxLength) => {
  let toPrune = str;
  if (!isString(toPrune)) {
    toPrune = '';
    logger.warn('Prune was called on a non-string object');
  }
  return toPrune.substr(0, maxLength);
};

const isSecretKey = (regexes, key) => {
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

const scrub = (
  payload,
  maxPayloadSize = getEventEntitySize(),
  skipScrubPath = null,
  method = 'stringify'
) => {
  let totalSize = 0;
  let refsFound = [];
  const regexes = keyToOmitRegexes();
  const secretItemsToSkipScrubbing = new Set(getItemsInPath(payload, skipScrubPath));

  let isPruned = false;
  let result = JSON[method](payload, function (key, value) {
    const type = typeof value;
    const isObj = type === 'object';
    const isStr = type === 'string';

    const shouldSkipSecretScrub =
      skipScrubPath &&
      skipScrubPath[skipScrubPath.length - 1] === key &&
      secretItemsToSkipScrubbing.has(this);
    if (totalSize < maxPayloadSize) {
      if (!(isObj && refsFound.includes(value))) {
        if (!shouldSkipSecretScrub && isSecretKey(regexes, key)) return SCRUBBED_TEXT;
        if (isNativeType(value)) {
          totalSize += getNativeVarSize(value) + getNativeVarSize(key);
        }
        if (isObj) {
          refsFound.push(value);
        }
        if (value && isStr && value.length > maxPayloadSize) {
          isPruned = true;
          return prune(value, maxPayloadSize);
        }
        if (value instanceof Error)
          return {
            stack: prune(value.stack, maxPayloadSize),
            message: value.message,
          };

        return value;
      } else {
        isPruned = true;
      }
    } else {
      isPruned = true;
    }
  });
  if (method === 'parse' && !isString(result)) {
    result = JSON.stringify(result);
  }
  if (result && isPruned) {
    result = result.replace(/,null/g, '');
    result = result.concat(TRUNCATED_TEXT);
  }
  return result || '';
};

export const payloadParse = (
  payload,
  maxPayloadSize = getEventEntitySize(),
  skipScrubPath = null
) => scrub(payload, maxPayloadSize, skipScrubPath, 'parse');

export const payloadStringify = (
  payload,
  maxPayloadSize = getEventEntitySize(),
  skipScrubPath = null
) => {
  return scrub(payload, maxPayloadSize, skipScrubPath);
};
