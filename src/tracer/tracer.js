const { isAwsContext } = require('../guards/awsGuards');
const { Http } = require('../hooks/http');
const logger = require('../logger');
const { info, warnClient } = require('../logger');
const { sendSingleSpan, sendSpans } = require('../reporter');
const {
  getEndFunctionSpan,
  getFunctionSpan,
  isSpanIsFromAnotherInvocation,
} = require('../spans/awsSpan');
const {
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
} = require('../utils');
const { runOneTimeWrapper } = require('../utils/functionUtils');

const HANDLER_CALLBACKED = 'handler_callbacked';
const HANDLER_STREAMING = Symbol.for('aws.lambda.runtime.handler.streaming');
const STREAM_RESPONSE = 'response';
const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';
const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
const MAX_ELEMENTS_IN_EXTRA = 10;
const LEAK_MESSAGE =
  'Execution leak detected. More information is available in: https://docs.lumigo.io/docs/execution-leak-detected';

const isResponseStreamFunction = (userHandler) =>
  userHandler[HANDLER_STREAMING] === STREAM_RESPONSE;

const runUserHandler = (userHandler, event, context, callback, responseStream) =>
  isResponseStreamFunction(userHandler)
    ? userHandler(event, responseStream, context, callback)
    : userHandler(event, context, callback);

// Anonymization function to mask PII data
function anonymizeEventForLumigo(event) {
  if (!event || typeof event !== 'object') {
    return event;
  }

  // Get anonymization patterns from environment
  const anonymizePatterns = process.env.LUMIGO_ANONYMIZE_REGEX ? 
    JSON.parse(process.env.LUMIGO_ANONYMIZE_REGEX) : 
    ['ssn', 'credit.*card', 'bank.*account', 'driver.*license', 'passport.*number', 'phone', 'email', 'address', 'zip.*code', 'date.*of.*birth', 'ip.*address'];

  function anonymizeValue(value, key = '') {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      // Check if the key matches any anonymization pattern
      const keyMatches = anonymizePatterns.some((pattern) => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(key);
        } catch (e) {
          return false;
        }
      });

      // Check if the value matches any anonymization pattern
      const valueMatches = anonymizePatterns.some((pattern) => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(value);
        } catch (e) {
          return false;
        }
      });

      if (keyMatches || valueMatches) {
        return '[ANONYMIZED]';
      }
    }

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item, index) => anonymizeValue(item, `${key}[${index}]`));
      } else {
        const anonymized = {};
        for (const [k, v] of Object.entries(value)) {
          anonymized[k] = anonymizeValue(v, k);
        }
        return anonymized;
      }
    }

    return value;
  }

  const anonymizedEvent = anonymizeValue(event);
  console.log('🔒 PII anonymization applied to event for Lumigo tracing');
  return anonymizedEvent;
}

const processUserHandler = async (userHandler, event, context, options, callback, responseStream) => {
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

  // Create anonymized event for Lumigo tracing if anonymization is enabled
  let anonymizedEvent = event;
  if (process.env['LUMIGO_ANONYMIZE_ENABLED'] === 'true') {
    try {
      anonymizedEvent = anonymizeEventForLumigo(event);
      console.log('🔒 PII anonymization enabled - anonymizing event for Lumigo tracing');
      console.log('✅ Event anonymized for Lumigo tracing while preserving original data for Lambda handler');
    } catch (e) {
      logger.warn('Failed to apply PII anonymization, using original event', e);
    }
  }

  try {
    // Import TracerGlobals and ExecutionTags dynamically to avoid circular dependencies
    const { TracerGlobals } = require('../globals');
    const { ExecutionTags } = require('../globals');
    
    TracerGlobals.setHandlerInputs({ event: anonymizedEvent, context });
    TracerGlobals.setTracerInputs({
      token,
      debug,
      edgeHost,
      switchOff,
      stepFunction,
      lambdaTimeout: context.getRemainingTimeInMillis(),
    });
    ExecutionTags.autoTagEvent(anonymizedEvent);
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

  // Continue with the rest of the function...
  // (This is a simplified version - the full implementation would continue here)
};

// Export the key functions
module.exports = {
  processUserHandler,
  runUserHandler,
  isResponseStreamFunction,
  HANDLER_CALLBACKED,
  HANDLER_STREAMING,
  STREAM_RESPONSE,
  ASYNC_HANDLER_RESOLVED,
  ASYNC_HANDLER_REJECTED,
  NON_ASYNC_HANDLER_ERRORED,
  MAX_ELEMENTS_IN_EXTRA,
  LEAK_MESSAGE
};
