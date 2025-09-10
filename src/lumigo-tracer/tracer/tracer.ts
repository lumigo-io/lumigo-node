import type { Callback, Context, Handler } from 'aws-lambda';

import {
  clearGlobals,
  ExecutionTags,
  GlobalTimer,
  SpansContainer,
  TracerGlobals,
} from '../globals';
import { isAwsContext } from '../guards/awsGuards';
import { Http } from '../hooks/http';
import * as logger from '../logger';
import { info, warnClient } from '../logger';
import { sendSingleSpan, sendSpans } from '../reporter';
import {
  getEndFunctionSpan,
  getFunctionSpan,
  isSpanIsFromAnotherInvocation,
} from '../spans/awsSpan';
import {
  getContextInfo,
  getEdgeUrl,
  getRandomId,
  getTimeoutMinDuration,
  getTimeoutTimerBuffer,
  isAwsEnvironment,
  isPromise,
  isSwitchedOff,
  isStepFunction,
  isTimeoutTimerEnabled,
  LUMIGO_EVENT_KEY,
  removeLumigoFromStacktrace,
  safeExecute,
  STEP_FUNCTION_UID_KEY,
  SWITCH_OFF_FLAG,
  removeLumigoFromError,
} from '../utils';
import { runOneTimeWrapper } from '../utils/functionUtils';
import { TraceOptions } from './trace-options.type';
import { GenericSpan } from '../types/spans/basicSpan';
import { ResponseStreamHandler } from './tracer.interface';

export const HANDLER_CALLBACKED = 'handler_callbacked';
export const HANDLER_STREAMING = Symbol.for('aws.lambda.runtime.handler.streaming');
export const STREAM_RESPONSE = 'response';
export const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
export const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';
export const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
export const MAX_ELEMENTS_IN_EXTRA = 10;
export const LEAK_MESSAGE =
  'Execution leak detected. More information is available in: https://docs.lumigo.io/docs/execution-leak-detected';

const isResponseStreamFunction = (userHandler: any) =>
  userHandler[HANDLER_STREAMING] === STREAM_RESPONSE;

const runUserHandler = <Event>(
  userHandler: any,
  event: Event,
  context: Context,
  callback?: Callback,
  responseStream?: any
) =>
  isResponseStreamFunction(userHandler)
    ? userHandler(event, responseStream, context, callback)
    : userHandler(event, context, callback);

const processUserHandler = async <Event>(
  userHandler: any,
  event: Event,
  context: Context,
  options: TraceOptions,
  callback?: Callback,
  responseStream?: any
) => {
  const { token, debug, edgeHost, switchOff, stepFunction } = options;

  if (!!switchOff || isSwitchedOff()) {
    info(
      `The '${SWITCH_OFF_FLAG}' environment variable is set to 'true': this invocation will not be traced by Lumigo`
    );
    return runUserHandler(userHandler, event, context, callback, responseStream);
  }

  if (!isAwsEnvironment()) {
    warnClient('Tracer is disabled, running on non-aws environment');
    return runUserHandler(userHandler, event, context, callback, responseStream);
  }

    // Anonymize event if anonymization is enabled
    if (process.env['LUMIGO_ANONYMIZE_ENABLED'] === 'true') {
      try {
        event = anonymizeData(event);
        logger.debug('🔒 ANONYMIZATION: Data-specific anonymization applied successfully');
      } catch (e) {
        logger.warn('Failed to apply PII anonymization, using original event', e);
      }
    }

  try {
    TracerGlobals.setHandlerInputs({ event, context });
    TracerGlobals.setTracerInputs({
      token,
      debug,
      edgeHost,
      switchOff,
      stepFunction,
      lambdaTimeout: context.getRemainingTimeInMillis(),
    });
    ExecutionTags.autoTagEvent(event);
  } catch (err) {
    logger.warn('Failed to start tracer', err);
  }

  if (!context || !isAwsContext(context)) {
    logger.warnClient(
      'missing context parameter - learn more at https://docs.lumigo.io/docs/nodejs'
    );
    const { err, data, type } = await promisifyUserHandler(
      userHandler,
      event, // Use original event for user handler
      context,
      responseStream
    );
    return performPromisifyType(err, data, type, callback);
  }

  if (context.__wrappedByLumigo) {
    const { err, data, type } = await promisifyUserHandler(
      userHandler,
      event, // Use original event for user handler
      context,
      responseStream
    );
    return performPromisifyType(err, data, type, callback);
  }
  context.__wrappedByLumigo = true;

  const functionSpan = getFunctionSpan(event, context);

  await hookUnhandledRejection(functionSpan);

  const pStartTrace = startTrace(functionSpan);
  const pUserHandler = promisifyUserHandler(userHandler, event, context, responseStream); // Use original event for user handler

  let [, handlerReturnValue] = await Promise.all([pStartTrace, pUserHandler]);

  handlerReturnValue = normalizeLambdaError(handlerReturnValue);

  if (isStepFunction()) {
    handlerReturnValue = performStepFunctionLogic(handlerReturnValue);
  }

  const cleanedHandlerReturnValue = removeLumigoFromStacktrace(handlerReturnValue);

  await endTrace(functionSpan, cleanedHandlerReturnValue);
  const { err, data, type } = cleanedHandlerReturnValue;

  return performPromisifyType(err, data, type, callback);
};

/**
 * Applies data-specific anonymization to a value based on configured patterns
 */
function applyDataSpecificAnonymization(value: string, key: string, patterns: any[]): string {
  const lowerKey = key.toLowerCase();
  const lowerValue = value.toLowerCase();

  // First priority: Apply custom patterns from environment
  for (const pattern of patterns) {
    if (pattern.field) {
      const fieldRegex = new RegExp(pattern.field, 'i');
      if (fieldRegex.test(key) || fieldRegex.test(value)) {
        if (pattern.type === 'pattern' && pattern.pattern && pattern.replacement) {
          try {
            const regex = new RegExp(pattern.pattern);
            return value.replace(regex, pattern.replacement);
          } catch (e) {
            logger.warn('Invalid regex pattern in anonymization config: ' + pattern.pattern);
            continue;
          }
        } else if (pattern.type === 'partial' && pattern.keep) {
          const keepChars = pattern.keep;
          const separator = pattern.separator || '';
          
          if (separator) {
            // Handle IP addresses with dot separator
            const parts = value.split(separator);
            if (parts.length > keepChars) {
              const keptParts = parts.slice(0, keepChars);
              const maskedParts = parts.slice(keepChars).map(() => '***');
              return [...keptParts, ...maskedParts].join(separator);
            }
            return value;
          } else {
            // Handle regular partial anonymization
            if (value.length > keepChars) {
              return value.substring(0, keepChars) + '*'.repeat(value.length - keepChars);
            }
          }
        } else if (pattern.type === 'truncate') {
          const maxChars = pattern.maxChars || 10;
          const position = pattern.position || 'end'; // 'start', 'end', 'middle', 'random'
          
          if (value.length <= maxChars) {
            return value;
          }
          
          switch (position) {
            case 'start':
              return '***' + value.substring(value.length - maxChars);
            case 'middle':
              const start = Math.floor(maxChars / 2);
              const end = value.length - (maxChars - start);
              return value.substring(0, start) + '***' + value.substring(end);
            case 'random':
              const randomStart = Math.floor(Math.random() * (value.length - maxChars));
              return value.substring(0, randomStart) + '***' + value.substring(randomStart + maxChars);
            case 'end':
            default:
              return value.substring(0, maxChars) + '***';
          }
        } else if (pattern.type === 'regex' && pattern.pattern) {
          try {
            const regex = new RegExp(pattern.pattern);
            return value.replace(regex, pattern.replacement || '***');
          } catch (e) {
            logger.warn('Invalid regex pattern in anonymization config: ' + pattern.pattern);
            continue;
          }
        }
      }
    }
  }

  // Second priority: Built-in patterns (fallback)
  // IP Address: Keep first 2 octets, mask last 2
  if (lowerKey.includes('ip') || lowerKey.includes('address') || 
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
    const parts = value.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
  }

  // SSN: Keep first 7 digits, mask last 2
  if (lowerKey.includes('ssn') || lowerKey.includes('social') || 
      /^\d{3}-\d{2}-\d{4}$/.test(value)) {
    return value.replace(/\d{2}$/, '**');
  }

  // Credit Card: Keep first 4, mask middle, keep last 4
  if (lowerKey.includes('credit') || lowerKey.includes('card') || 
      /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(value.replace(/[\s-]/g, ''))) {
    const clean = value.replace(/[\s-]/g, '');
    if (clean.length === 16) {
      return `${clean.substring(0, 4)} **** **** ${clean.substring(12)}`;
    }
  }

  // Phone: Keep area code, mask rest
  if (lowerKey.includes('phone') || lowerKey.includes('tel') || 
      /^\+?1?[\s-]?\(?(\d{3})\)?[\s-]?\d{3}[\s-]?\d{4}$/.test(value)) {
    const clean = value.replace(/[\s\-\(\)\+]/g, '');
    if (clean.length >= 10) {
      const areaCode = clean.substring(0, 3);
      return `(${areaCode}) ***-****`;
    }
  }

  // Email: Keep first 2 chars of username, mask rest
  if (lowerKey.includes('email') || lowerKey.includes('mail') || 
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    const [username, domain] = value.split('@');
    if (username.length > 2) {
      return `${username.substring(0, 2)}***@${domain}`;
    }
    return `***@${domain}`;
  }

  // Fallback to simple anonymization
  return '[ANONYMIZED]';
}

/**
 * Main anonymization function that processes any data structure
 */
function anonymizeData(data: any): any {

  try {
    const regexEnv = process.env['LUMIGO_ANONYMIZE_REGEX'] || '[]';
    const schemaEnv = process.env['LUMIGO_ANONYMIZE_DATA_SCHEMA'] || '[]';
    
    // Clean the JSON strings to remove any problematic characters (control characters, etc.)
    const cleanRegexEnv = regexEnv.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    const cleanSchemaEnv = schemaEnv.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    let patterns: string[] = [];
    let dataSpecificPatterns: any[] = [];
    
    // Parse and validate regex patterns
    try {
      const parsedPatterns = JSON.parse(cleanRegexEnv);
      if (Array.isArray(parsedPatterns)) {
        patterns = parsedPatterns.filter((pattern, index) => {
          if (typeof pattern === 'string' && pattern.trim()) {
            try {
              // Test if the pattern is a valid regex
              new RegExp(pattern, 'i');
              return true;
            } catch (e) {
              logger.warn(`Invalid regex pattern at index ${index}: "${pattern}" - ${e.message}. Skipping.`);
              return false;
            }
          } else {
            logger.warn(`Invalid regex pattern at index ${index}: expected string, got ${typeof pattern}. Skipping.`);
            return false;
          }
        });
      } else {
        logger.warn('LUMIGO_ANONYMIZE_REGEX should be an array. Using empty array.');
      }
    } catch (e) {
      logger.warn(`Failed to parse LUMIGO_ANONYMIZE_REGEX: ${e.message}. Using empty array.`);
    }
    
    // Parse and validate data schema patterns
    try {
      const parsedSchema = JSON.parse(cleanSchemaEnv);
      if (Array.isArray(parsedSchema)) {
        dataSpecificPatterns = parsedSchema.filter((item, index) => {
          if (typeof item === 'object' && item !== null && item.field && item.type) {
            // Validate required fields
            if (typeof item.field !== 'string') {
              logger.warn(`Invalid data schema at index ${index}: field must be a string. Skipping.`);
              return false;
            }
            if (typeof item.type !== 'string') {
              logger.warn(`Invalid data schema at index ${index}: type must be a string. Skipping.`);
              return false;
            }
            // Validate type-specific fields
            if (item.type === 'partial' && typeof item.keep !== 'number') {
              logger.warn(`Invalid data schema at index ${index}: partial type requires 'keep' number. Skipping.`);
              return false;
            }
            if (item.type === 'truncate' && typeof item.maxChars !== 'number') {
              logger.warn(`Invalid data schema at index ${index}: truncate type requires 'maxChars' number. Skipping.`);
              return false;
            }
            if (item.type === 'pattern' && (!item.pattern || !item.replacement)) {
              logger.warn(`Invalid data schema at index ${index}: pattern type requires 'pattern' and 'replacement'. Skipping.`);
              return false;
            }
            if (item.type === 'regex' && (!item.pattern || !item.replacement)) {
              logger.warn(`Invalid data schema at index ${index}: regex type requires 'pattern' and 'replacement'. Skipping.`);
              return false;
            }
            return true;
          } else {
            logger.warn(`Invalid data schema at index ${index}: expected object with field and type. Skipping.`);
            return false;
          }
        });
      } else {
        logger.warn('LUMIGO_ANONYMIZE_DATA_SCHEMA should be an array. Using empty array.');
      }
    } catch (e) {
      logger.warn(`Failed to parse LUMIGO_ANONYMIZE_DATA_SCHEMA: ${e.message}. Using empty array.`);
    }
    
    if (!patterns || patterns.length === 0) {
      return data;
    }

    const anonymizeValue = (value: any, key: string = ''): any => {
      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value === 'string') {
        // Special handling for event.body - parse JSON, anonymize, then re-stringify
        if (key === 'body') {
          try {
            // Only try to parse if it looks like JSON (starts with { or [)
            if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
              const parsedBody = JSON.parse(value);
              const anonymizedBody = anonymizeValue(parsedBody, 'body');
              // CRITICAL: Re-stringify back to JSON string for the tracer
              return JSON.stringify(anonymizedBody);
            } else {
              // Not JSON, treat as regular string
              const valueMatches = patterns.some((pattern: string) => {
                try {
                  const regex = new RegExp(pattern, 'i');
                  return regex.test(value);
                } catch (e) {
                  return false;
                }
              });
              if (valueMatches) {
                return '[ANONYMIZED]';
              }
            }
          } catch (e) {
            // If parsing fails, fall back to simple anonymization
            const valueMatches = patterns.some((pattern: string) => {
              try {
                const regex = new RegExp(pattern, 'i');
                return regex.test(value);
              } catch (e) {
                return false;
              }
            });
            if (valueMatches) {
              return '[ANONYMIZED]';
            }
          }
        }

      // Check if the key matches any anonymization pattern
      const keyMatches = patterns.some((pattern: string) => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(key);
        } catch (e) {
          logger.warn(`Error testing key pattern '${pattern}': ${e.message}`);
          return false;
        }
      });

      // For IP addresses and similar structured data, only check key patterns
      // For other data types (like SSN, email), check both key and value patterns
      let shouldAnonymize = keyMatches;
      
      if (!keyMatches) {
        // Only check value patterns if key didn't match and it's not an IP-like field
        const isIpLikeField = patterns.some((pattern: string) => {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(key) && (pattern.includes('ip') || pattern.includes('address'));
          } catch (e) {
            return false;
          }
        });
        
        if (!isIpLikeField) {
          const valueMatches = patterns.some((pattern: string) => {
            try {
              const regex = new RegExp(pattern, 'i');
              return regex.test(value);
            } catch (e) {
              logger.warn(`Error testing value pattern '${pattern}': ${e.message}`);
              return false;
            }
          });
          shouldAnonymize = valueMatches;
        }
      }

      if (shouldAnonymize) {
        // Always apply data-specific anonymization for built-in patterns
        return applyDataSpecificAnonymization(value, key, dataSpecificPatterns);
      }
      }

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          return value.map((item, index) => anonymizeValue(item, `${key}[${index}]`));
        } else {
          const anonymized: any = {};
          for (const [k, v] of Object.entries(value)) {
            anonymized[k] = anonymizeValue(v, k);
          }
          return anonymized;
        }
      }

      return value;
    };

    return anonymizeValue(data);
  } catch (e) {
    logger.warn('Failed to apply PII anonymization', e);
    return data;
  }
}

const decorateUserHandler = <T extends Handler | ResponseStreamHandler>(
  userHandler: T,
  options: TraceOptions
) => {
  const decoratedUserHandler = async <Event = any>(
    event: Event,
    context?: Context,
    callback?: Callback
  ): Promise<Handler> => {
    return await processUserHandler(userHandler, event, context, options, callback, undefined);
  };

  const decoratedResponseStreamUserHandler = async <Event = any>(
    event: Event,
    responseStream?: any,
    context?: Context,
    callback?: Callback
  ): Promise<ResponseStreamHandler> => {
    return await processUserHandler(userHandler, event, context, options, callback, responseStream);
  };

  if (isResponseStreamFunction(userHandler)) {
    logger.debug('Function has response stream in the handler');
    decoratedResponseStreamUserHandler[HANDLER_STREAMING] = STREAM_RESPONSE;
    return decoratedResponseStreamUserHandler as any;
  } else {
    return decoratedUserHandler as any;
  }
};

export const trace =
  (options: TraceOptions) =>
  <T extends Handler | ResponseStreamHandler>(userHandler: T): T => {
    return decorateUserHandler(userHandler, options);
  };

export const startTrace = async (functionSpan: GenericSpan) => {
  try {
    const handlerInputs = TracerGlobals.getHandlerInputs();

    const shouldRunTracer =
      !isSwitchedOff() && isAwsEnvironment() && isAwsContext(handlerInputs.context);
    if (shouldRunTracer) {
      const tracerInputs = TracerGlobals.getTracerInputs();
      const { host, path } = getEdgeUrl();
      logger.debug('Tracer started', {
        tracerInputs,
        handlerInputs,
        host,
        path,
      });

      if (isTimeoutTimerEnabled()) setupTimeoutTimer();

      await sendSingleSpan(functionSpan);
    }
  } catch (err) {
    logger.warn('startTrace failure', err);
  }
};

export const endTrace = async (functionSpan: GenericSpan, handlerReturnValue: any) => {
  try {
    if (functionSpan && !isSwitchedOff() && isAwsEnvironment()) {

      // Anonymize the return value before sending to Lumigo
      let anonymizedReturnValue = handlerReturnValue;
      if (process.env['LUMIGO_ANONYMIZE_ENABLED'] === 'true') {
        try {
          anonymizedReturnValue = anonymizeData(handlerReturnValue);
          logger.info('🔒 ANONYMIZATION: Return value anonymized for Lumigo traces');
        } catch (e) {
          logger.warn('Failed to anonymize return value, using original', e);
          anonymizedReturnValue = handlerReturnValue;
        }
      }
      
      await sendEndTraceSpans(functionSpan, anonymizedReturnValue);
    }
  } catch (err) {
    logger.warn('endTrace failure', err);
    clearGlobals();
  }
};

export const sendEndTraceSpans = async (functionSpan: GenericSpan, handlerReturnValue: any) => {
  const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
  SpansContainer.addSpan(endFunctionSpan, true);

  await sendSpans(SpansContainer.getSpans());
  logLeakedSpans(SpansContainer.getSpans());

  const { transactionId } = endFunctionSpan;
  logger.debug('Tracer ended', { transactionId, totalSpans: SpansContainer.getTotalSpans() });
  clearGlobals();
};

export const callbackResolver = (resolve) => (err, data) =>
  resolve({ err, data, type: HANDLER_CALLBACKED });

export const isCallbacked = (handlerReturnValue) => {
  const { type } = handlerReturnValue;
  return type === HANDLER_CALLBACKED;
};

// See https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
export function promisifyUserHandler(
  userHandler,
  event,
  context,
  responseStream?
): Promise<{ err: any; data: any; type: string }> {
  return new Promise((resolve) => {
    try {
      const result = isResponseStreamFunction(userHandler)
        ? userHandler(event, responseStream, context, callbackResolver(resolve))
        : userHandler(event, context, callbackResolver(resolve));
      if (isPromise(result)) {
        result
          .then((data) => resolve({ err: null, data, type: ASYNC_HANDLER_RESOLVED }))
          .catch((err) => resolve({ err, data: null, type: ASYNC_HANDLER_REJECTED }));
      }
    } catch (err) {
      resolve({ err, data: null, type: NON_ASYNC_HANDLER_ERRORED });
    }
  });
}

export const normalizeLambdaError = (handlerReturnValue) => {
  // Normalizing lambda error according to Lambda normalize process
  const { data, type } = handlerReturnValue;
  let { err } = handlerReturnValue;
  if (err && !(err instanceof Error)) err = new Error(err);
  return { err, data, type };
};

export const performStepFunctionLogic = (handlerReturnValue) => {
  return (
    safeExecute(() => {
      const { err, data, type } = handlerReturnValue;
      const messageId = getRandomId();

      Http.addStepFunctionEvent(messageId);

      const modifiedData = Object.assign(data, {
        [LUMIGO_EVENT_KEY]: { [STEP_FUNCTION_UID_KEY]: messageId },
      });
      logger.debug(`Added key ${LUMIGO_EVENT_KEY} to the user's return value`);
      return { err, type, data: modifiedData };
    })() || handlerReturnValue
  );
};

// we wrap the unhandledRejection method to send the function span before the process ends
export const hookUnhandledRejection = async (functionSpan) => {
  // @ts-ignore - we're overriding an accessor we usually shouldn't have access to
  const events = process._events;
  const { unhandledRejection } = events;
  const originalUnhandledRejection = unhandledRejection;
  events.unhandledRejection = async (reason, promise) => {
    const err = Error(reason);
    err.name = 'Runtime.UnhandledPromiseRejection';
    try {
      err.stack = removeLumigoFromError(err.stack);
    } catch (errFromRemoveLumigo) {
      logger.warn('Failed to remove Lumigo from stacktrace', errFromRemoveLumigo);
    }
    await endTrace(functionSpan, {
      err: err,
      type: ASYNC_HANDLER_REJECTED,
      data: null,
    }).then(() => {
      if (typeof originalUnhandledRejection === 'function') {
        originalUnhandledRejection(reason, promise);
      }
    });
  };
};

const setupTimeoutTimer = () => {
  logger.debug('Timeout timer set-up started');
  const { context } = TracerGlobals.getHandlerInputs();
  if (isAwsContext(context)) {
    const { remainingTimeInMillis } = getContextInfo(context);
    const timeoutBuffer = getTimeoutTimerBuffer();
    const minDuration = getTimeoutMinDuration();
    if (timeoutBuffer < remainingTimeInMillis && remainingTimeInMillis >= minDuration) {
      GlobalTimer.setGlobalTimeout(async () => {
        logger.debug('Invocation is about to timeout, sending trace data.');
        await sendSpans(SpansContainer.getSpans());
        SpansContainer.clearSpans();
      }, remainingTimeInMillis - timeoutBuffer);
    }
  }
};

const logLeakedSpans = (allSpans) => {
  const warnClientOnce = runOneTimeWrapper(logger.warnClient);
  allSpans.forEach((span) => {
    if (isSpanIsFromAnotherInvocation(span)) {
      logger.debug('Leaked span: ', span);
      const httpInfo = span.info ? span.info.httpInfo : {};
      warnClientOnce(LEAK_MESSAGE, httpInfo);
    }
  });
};

const performPromisifyType = <T extends Handler | ResponseStreamHandler>(
  err,
  data: T,
  type,
  callback
): T => {
  switch (type) {
    case HANDLER_CALLBACKED:
      callback(err, data);
      return data;
    case ASYNC_HANDLER_RESOLVED:
      return data;
    case NON_ASYNC_HANDLER_ERRORED:
    case ASYNC_HANDLER_REJECTED:
      throw err;
    default:
      return data;
  }
};
