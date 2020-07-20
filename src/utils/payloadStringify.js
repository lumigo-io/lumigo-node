// import { keyToOmitRegexes, MAX_ENTITY_SIZE, SKIP_SCRUBBING_KEYS } from '../utils';

import {
  getEventEntitySize,
  LUMIGO_SECRET_MASKING_REGEX,
  LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  OMITTING_KEYS_REGEXES,
  parseJsonFromEnvVar,
} from '../utils';

const nativeTypes = ['string', 'bigint', 'number', 'undefined', 'boolean'];
const SCRUBBED_TEXT = '****';

const isNativeType = obj => nativeTypes.includes(typeof obj);

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

  return regexesList.map(x => new RegExp(x, 'i'));
};

const prune = (str, maxLength) => (str || '').substr(0, maxLength);

const isSecretKey = (regexes, key) => {
  if (!isNaN(key)) {
    //optimization for arrays
    return false;
  }
  return !!regexes.some(regex => regex.test(key));
};

//Base64 calculation taken from : https://stackoverflow.com/questions/13378815/base64-length-calculation
const getNativeVarSize = obj => (obj ? (obj.toString().length * 4) / 3 : 0);

export const payloadStringify = (payload, maxPayloadSize = getEventEntitySize()) => {
  let totalSize = 0;
  let refsFound = [];
  const regexes = keyToOmitRegexes();

  const result = JSON.stringify(payload, (key, value) => {
    const isObj = typeof value === 'object';
    if (!(isObj && refsFound.includes(value)))
      if (totalSize < maxPayloadSize) {
        if (isSecretKey(regexes, key)) return SCRUBBED_TEXT;
        if (isNativeType(value)) {
          totalSize += getNativeVarSize(value);
        }
        if (isObj) {
          refsFound.push(value);
        }
        if (value && value.length && value.length > maxPayloadSize)
          return prune(value, maxPayloadSize);
        return value;
      }
  });

  return result || '';
};
