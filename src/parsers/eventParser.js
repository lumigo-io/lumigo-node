import * as logger from '../logger';
import { getEnvVarAsList } from '../utils';

const API_GW_REGEX = /.*execute-api.*amazonaws\.com.*/;

const API_GW_KEYS_ORDER = getEnvVarAsList('LUMIGO_API_GW_KEYS_ORDER', [
  'version',
  'routeKey',
  'rawPath',
  'rawQueryString',
  'resource',
  'path',
  'httpMethod',
  'queryStringParameters',
  'pathParameters',
  'body',
  'requestContext',
  'headers',
]);
const API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS = getEnvVarAsList(
  'LUMIGO_API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS',
  ['cookie', 'x-amz', 'accept', 'cloudfront', 'via', 'x-forwarded', 'sec-']
);
const API_GW_REQUEST_CONTEXT_FILTER_KEYS = getEnvVarAsList(
  'LUMIGO_API_GW_REQUEST_CONTEXT_FILTER_KEYS',
  ['authorizer', 'http']
);
const API_GW_KEYS_DELETE_KEYS = getEnvVarAsList(
  'LUMIGO_API_GW_KEYS_DELETE_KEYS',
  ['multiValueHeaders', 'multiValueQueryStringParameters']
);

export const isApiGwEvent = event => {
  if (
    event != null &&
    event.requestContext != null &&
    event.requestContext.domainName != null
  ) {
    return event.requestContext.domainName.match(API_GW_REGEX);
  }
  return false;
};

export const parseApiGwEvent = event => {
  const parsed_event = {};
  // Add order keys
  for (const order_key of API_GW_KEYS_ORDER) {
    if (event[order_key] != null) {
      parsed_event[order_key] = event[order_key];
    }
  }
  // Remove requestContext keys
  if (event.requestContext != null) {
    parsed_event['requestContext'] = {};
    for (const rc_key of Object.keys(event.requestContext)) {
      if (API_GW_REQUEST_CONTEXT_FILTER_KEYS.includes(rc_key.toLowerCase())) {
        parsed_event['requestContext'][rc_key] =
          event['requestContext'][rc_key];
      }
    }
  }
  // Remove headers keys
  if (event.headers != null) {
    parsed_event['headers'] = {};
    for (const h_key of Object.keys(event.headers)) {
      if (
        API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS.find(v =>
          h_key.toLowerCase().startsWith(v)
        ) == null
      ) {
        parsed_event['headers'][h_key] = event['headers'][h_key];
      }
    }
  }
  // Add all other keys
  for (const key of Object.keys(event)) {
    if (
      !API_GW_KEYS_ORDER.includes(key) &&
      !API_GW_KEYS_DELETE_KEYS.includes(key)
    ) {
      parsed_event[key] = event[key];
    }
  }
  return parsed_event;
};

export const parseEvent = event => {
  try {
    if (isApiGwEvent(event)) {
      return parseApiGwEvent(event);
    }
    return event;
  } catch (e) {
    logger.warn('Failed to parse event', e);
    return event;
  }
};
