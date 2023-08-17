import * as logger from '../logger';
import {
  getEnvVarsMaskingRegex,
  getEventEntitySize,
  getHttpQueryParamsMaskingRegex,
  getRequestBodyMaskingRegex,
  getRequestHeadersMaskingRegex,
  getResponseBodyMaskingRegex,
  getResponseHeadersMaskingRegex,
  getSecretMaskingExactPath, isObject,
  isString,
  LUMIGO_SECRET_MASKING_ALL_MAGIC,
  LUMIGO_SECRET_MASKING_REGEX,
  LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  LUMIGO_WHITELIST_KEYS_REGEXES,
  OMITTING_KEYS_REGEXES,
  parseJsonFromEnvVar,
  safeExecute,
} from '../utils';
import {runOneTimeWrapper} from './functionUtils';
import {ExecutionTags} from "../globals";

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
  truncated = false
) => {
  let totalSize = 0;
  let refsFound = [];
  const secretsRegexes = keyToOmitRegexes();
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
  //TODO: SHANI -should the parse and scrub be here?
  if (getSecretMaskingExactPath()) {
    result =  recursivelyParseAndScrubJson(result);
  }
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



// const getParsedPayload = (secretScrubReq, innerPath) => {
//     let {payload: obj , keyToEvent: eventByKey , requestedPath , initialParsed, originalPayload} = secretScrubReq;
//     initialParsed.initialPath = initialParsed.initialPath === undefined ? innerPath : initialParsed.initialPath;
//     const relativePath = secretScrubReq.relativePath
//       ? [secretScrubReq.relativePath, innerPath].join('.')
//       : innerPath;
//     if (obj && obj[innerPath]) {
//       if (relativePath === requestedPath){
//         obj[innerPath] = SCRUBBED_TEXT;
//         eventByKey[relativePath] = obj;
//         return {
//             payload: obj[innerPath],
//             keyToEvent: eventByKey,
//             relativePath: relativePath,
//             requestedPath: requestedPath,
//           initialParsed: initialParsed,
//           originalPayload: originalPayload
//         };
//       }
//       eventByKey[relativePath] = obj;
//       return {
//           payload: obj[innerPath],
//           keyToEvent: eventByKey,
//           relativePath: relativePath,
//           requestedPath: requestedPath,
//         initialParsed: initialParsed,
//         originalPayload:originalPayload
//       };
//     }
//     if (eventByKey && eventByKey[relativePath]) {
//       obj = eventByKey[relativePath];
//       if (relativePath === requestedPath){
//         obj[innerPath] = SCRUBBED_TEXT;
//       }
//       eventByKey[relativePath] = obj;
//       initialParsed.value = relativePath;
//       return obj && { payload: obj[innerPath], keyToEvent: eventByKey, relativePath: relativePath, requestedPath: requestedPath , initialParsed: initialParsed,
//       originalPayload:originalPayload};
//     }
//     try {
//       if (obj && isString(obj) && obj[innerPath] === undefined) {
//         const parsedObj = JSON.parse(obj);
//         //TODO: SHANI - is it's array need to recursive getParsedPayload
//         if (Array.isArray(parsedObj)){
//           let path = '';
//           parsedObj.forEach((item, index) => {
//             const value = getParsedPayload({payload: item, keyToEvent: eventByKey, relativePath: path , requestedPath: requestedPath , initialParsed: initialParsed, originalPayload:originalPayload}, innerPath);
//             // eventByKey = value.keyToEvent;
//             path = value.relativePath;
//           })
//         }
//         initialParsed.value = relativePath;
//         if (relativePath === requestedPath && parsedObj[innerPath]){
//           parsedObj[innerPath] = SCRUBBED_TEXT;
//           // need to replace the in the original payload the parsed object by the parsedPath
//         }
//         eventByKey[relativePath] = parsedObj;
//         return (
//           parsedObj && {
//             payload: parsedObj[innerPath],
//             keyToEvent: eventByKey,
//             relativePath: relativePath,
//             requestedPath: requestedPath,
//             initialParsed: initialParsed,
//             originalPayload:originalPayload
//           }
//         );
//       }
//     } catch (err) {
//       logger.debug('Failed to parse json event as tag value', { error: err, event: obj });
//     }
//     return { payload: undefined, keyToEvent: eventByKey, relativePath: relativePath , requestedPath: requestedPath, initialParsed: initialParsed,
//     originalPayload:originalPayload};
//   };


//TODO: SHANI - wrap in safeExecute
function recursivelyParseAndScrubJson(payload) {
  let secretPathEnvVar = getSecretMaskingExactPath();
  let secretPath;
  try {
      secretPath = JSON.parse(secretPathEnvVar);
    } catch (e) {
      invalidMaskingRegexWarning(e);
      secretPath = null;
  }
  if (!secretPath) {
    return payload;
  }
  let keyToEventMap = {};
  // secretPath.forEach((path) => {
  //     const value = path
  //       .split('.')
  //       .reduce(getParsedPayload, { payload: payload, keyToEvent: keyToEventMap, relativePath: '', requestedPath: path , initialParsed:{initialPath:undefined, value:undefined}, originalPayload:payload});
  //     keyToEventMap = value.keyToEvent;
  //     const initialParsedValue = keyToEventMap[value.initialParsed.value];
  //     if (initialParsedValue) {
  //       if (isObject(payload)){
  //         finalRes[value.initialParsed.initialPath] = JSON.stringify(initialParsedValue);
  //       } else{
  //         finalRes = JSON.stringify(initialParsedValue);
  //       }
  //     }
  // });

  secretPath.forEach((key) => {
      const value = key
        .split('.')
        .reduce( ExecutionTags.getValue, { event: payload, keyToEvent: keyToEventMap, relativeKey: '' });
      keyToEventMap = value.keyToEvent;
      const splitKeys = key.split(".");
      const keyToReplace = splitKeys.pop()
      if (keyToEventMap[key] && keyToEventMap[key].value && keyToEventMap[key].value[keyToReplace]){
        keyToEventMap[key].value[keyToReplace] = SCRUBBED_TEXT
      }
    });

  Object.keys(keyToEventMap).map(key => {
    if (keyToEventMap[key].parsed) {
      keyToEventMap[key].value = JSON.stringify(keyToEventMap[key].value);
    }
    return keyToEventMap[key];
  });

  //TODO: SHANI - how do I return the final "un-parsed" payload?
  return finalRes;
}


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
