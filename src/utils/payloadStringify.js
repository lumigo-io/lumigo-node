// import { keyToOmitRegexes, MAX_ENTITY_SIZE, SKIP_SCRUBBING_KEYS } from '../utils';

import {
  EXECUTION_TAGS_KEY,
  LUMIGO_SECRET_MASKING_REGEX,
  LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  MAX_ENTITY_SIZE,
  OMITTING_KEYS_REGEXES,
  parseJsonFromEnvVar,
} from '../utils';

export const SKIP_SCRUBBING_KEYS = [EXECUTION_TAGS_KEY];
const nativeTypes = ['string', 'bigint', 'number', 'undefined', 'boolean'];
const scrubbedText = '****';

const isNativeType = obj => nativeTypes.includes(typeof obj);

const keyToOmitRegexes = () => {
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

const isSecretKey = (regexes, key) => {
  if (SKIP_SCRUBBING_KEYS.includes(key)) {
    return false;
  }
  return !!regexes.some(regex => regex.test(key));
};

//Base64 calculation taken from : https://stackoverflow.com/questions/13378815/base64-length-calculation
const getNativeVarSize = obj => (obj.toString().length * 4) / 3;

export const payloadStringify = (payload, maxPayloadSize = MAX_ENTITY_SIZE) => {
  let totalSize = 0;
  const regexes = keyToOmitRegexes();

  return JSON.stringify(payload, (key, value) => {
    if (totalSize < maxPayloadSize) {
      if (isSecretKey(regexes, key)) return scrubbedText;
      if (isNativeType(value)) {
        totalSize += getNativeVarSize(value);
      }
      return value;
    }
  });
};
