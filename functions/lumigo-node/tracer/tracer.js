var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { clearGlobals, ExecutionTags, GlobalTimer, SpansContainer, TracerGlobals, } from '../globals';
import { isAwsContext } from '../guards/awsGuards';
import { Http } from '../hooks/http';
import * as logger from '../logger';
import { info, warnClient } from '../logger';
import { sendSingleSpan, sendSpans } from '../reporter';
import { getEndFunctionSpan, getFunctionSpan, isSpanIsFromAnotherInvocation, } from '../spans/awsSpan';
import { getContextInfo, getEdgeUrl, getRandomId, getTimeoutMinDuration, getTimeoutTimerBuffer, isAwsEnvironment, isPromise, isSwitchedOff, isStepFunction, isTimeoutTimerEnabled, LUMIGO_EVENT_KEY, removeLumigoFromStacktrace, safeExecute, STEP_FUNCTION_UID_KEY, SWITCH_OFF_FLAG, removeLumigoFromError, } from '../utils';
import { runOneTimeWrapper } from '../utils/functionUtils';
export const HANDLER_CALLBACKED = 'handler_callbacked';
export const HANDLER_STREAMING = Symbol.for('aws.lambda.runtime.handler.streaming');
export const STREAM_RESPONSE = 'response';
export const ASYNC_HANDLER_RESOLVED = 'async_handler_resolved';
export const ASYNC_HANDLER_REJECTED = 'async_handler_rejected';
export const NON_ASYNC_HANDLER_ERRORED = 'non_async_errored';
export const MAX_ELEMENTS_IN_EXTRA = 10;
export const LEAK_MESSAGE = 'Execution leak detected. More information is available in: https://docs.lumigo.io/docs/execution-leak-detected';
const isResponseStreamFunction = (userHandler) => userHandler[HANDLER_STREAMING] === STREAM_RESPONSE;
const runUserHandler = (userHandler, event, context, callback, responseStream) => isResponseStreamFunction(userHandler)
    ? userHandler(event, responseStream, context, callback)
    : userHandler(event, context, callback);
const processUserHandler = (userHandler, event, context, options, callback, responseStream) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, debug, edgeHost, switchOff, stepFunction } = options;
    if (!!switchOff || isSwitchedOff()) {
        info(`The '${SWITCH_OFF_FLAG}' environment variable is set to 'true': this invocation will not be traced by Lumigo`);
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
            const patterns = JSON.parse(process.env['LUMIGO_ANONYMIZE_REGEX'] || '[]');
            if (patterns && patterns.length > 0) {
                // Inline anonymization logic
                const anonymizeValue = (value, key = '') => {
                    if (value === null || value === undefined) {
                        return value;
                    }
                    if (typeof value === 'string') {
                        // Check if the key matches any anonymization pattern
                        const keyMatches = patterns.some((pattern) => {
                            try {
                                const regex = new RegExp(pattern, 'i');
                                return regex.test(key);
                            }
                            catch (e) {
                                return false;
                            }
                        });
                        // Check if the value matches any anonymization pattern
                        const valueMatches = patterns.some((pattern) => {
                            try {
                                const regex = new RegExp(pattern, 'i');
                                return regex.test(value);
                            }
                            catch (e) {
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
                        }
                        else {
                            const anonymized = {};
                            for (const [k, v] of Object.entries(value)) {
                                anonymized[k] = anonymizeValue(v, k);
                            }
                            return anonymized;
                        }
                    }
                    return value;
                };
                anonymizedEvent = anonymizeValue(event);
                logger.debug('PII anonymization applied to event for Lumigo tracing');
            }
        }
        catch (e) {
            logger.warn('Failed to apply PII anonymization, using original event', e);
        }
    }
    try {
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
    }
    catch (err) {
        logger.warn('Failed to start tracer', err);
    }
    if (!context || !isAwsContext(context)) {
        logger.warnClient('missing context parameter - learn more at https://docs.lumigo.io/docs/nodejs');
        const { err, data, type } = yield promisifyUserHandler(userHandler, event, // Use original event for user handler
        context, responseStream);
        return performPromisifyType(err, data, type, callback);
    }
    if (context.__wrappedByLumigo) {
        const { err, data, type } = yield promisifyUserHandler(userHandler, event, // Use original event for user handler
        context, responseStream);
        return performPromisifyType(err, data, type, callback);
    }
    context.__wrappedByLumigo = true;
    const functionSpan = getFunctionSpan(anonymizedEvent, context); // Use anonymized event for span
    yield hookUnhandledRejection(functionSpan);
    const pStartTrace = startTrace(functionSpan);
    const pUserHandler = promisifyUserHandler(userHandler, event, context, responseStream); // Use original event for user handler
    let [, handlerReturnValue] = yield Promise.all([pStartTrace, pUserHandler]);
    handlerReturnValue = normalizeLambdaError(handlerReturnValue);
    if (isStepFunction()) {
        handlerReturnValue = performStepFunctionLogic(handlerReturnValue);
    }
    const cleanedHandlerReturnValue = removeLumigoFromStacktrace(handlerReturnValue);
    yield endTrace(functionSpan, cleanedHandlerReturnValue);
    const { err, data, type } = cleanedHandlerReturnValue;
    return performPromisifyType(err, data, type, callback);
});
const decorateUserHandler = (userHandler, options) => {
    const decoratedUserHandler = (event, context, callback) => __awaiter(void 0, void 0, void 0, function* () {
        return yield processUserHandler(userHandler, event, context, options, callback, undefined);
    });
    const decoratedResponseStreamUserHandler = (event, responseStream, context, callback) => __awaiter(void 0, void 0, void 0, function* () {
        return yield processUserHandler(userHandler, event, context, options, callback, responseStream);
    });
    if (isResponseStreamFunction(userHandler)) {
        logger.debug('Function has response stream in the handler');
        decoratedResponseStreamUserHandler[HANDLER_STREAMING] = STREAM_RESPONSE;
        return decoratedResponseStreamUserHandler;
    }
    else {
        return decoratedUserHandler;
    }
};
export const trace = (options) => (userHandler) => {
    return decorateUserHandler(userHandler, options);
};
export const startTrace = (functionSpan) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const handlerInputs = TracerGlobals.getHandlerInputs();
        const shouldRunTracer = !isSwitchedOff() && isAwsEnvironment() && isAwsContext(handlerInputs.context);
        if (shouldRunTracer) {
            const tracerInputs = TracerGlobals.getTracerInputs();
            const { host, path } = getEdgeUrl();
            logger.debug('Tracer started', {
                tracerInputs,
                handlerInputs,
                host,
                path,
            });
            if (isTimeoutTimerEnabled())
                setupTimeoutTimer();
            yield sendSingleSpan(functionSpan);
        }
    }
    catch (err) {
        logger.warn('startTrace failure', err);
    }
});
export const endTrace = (functionSpan, handlerReturnValue) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (functionSpan && !isSwitchedOff() && isAwsEnvironment()) {
            yield sendEndTraceSpans(functionSpan, handlerReturnValue);
        }
    }
    catch (err) {
        logger.warn('endTrace failure', err);
        clearGlobals();
    }
});
export const sendEndTraceSpans = (functionSpan, handlerReturnValue) => __awaiter(void 0, void 0, void 0, function* () {
    const endFunctionSpan = getEndFunctionSpan(functionSpan, handlerReturnValue);
    SpansContainer.addSpan(endFunctionSpan, true);
    yield sendSpans(SpansContainer.getSpans());
    logLeakedSpans(SpansContainer.getSpans());
    const { transactionId } = endFunctionSpan;
    logger.debug('Tracer ended', { transactionId, totalSpans: SpansContainer.getTotalSpans() });
    clearGlobals();
});
export const callbackResolver = (resolve) => (err, data) => resolve({ err, data, type: HANDLER_CALLBACKED });
export const isCallbacked = (handlerReturnValue) => {
    const { type } = handlerReturnValue;
    return type === HANDLER_CALLBACKED;
};
// See https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
export function promisifyUserHandler(userHandler, event, context, responseStream) {
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
        }
        catch (err) {
            resolve({ err, data: null, type: NON_ASYNC_HANDLER_ERRORED });
        }
    });
}
export const normalizeLambdaError = (handlerReturnValue) => {
    // Normalizing lambda error according to Lambda normalize process
    const { data, type } = handlerReturnValue;
    let { err } = handlerReturnValue;
    if (err && !(err instanceof Error))
        err = new Error(err);
    return { err, data, type };
};
export const performStepFunctionLogic = (handlerReturnValue) => {
    return (safeExecute(() => {
        const { err, data, type } = handlerReturnValue;
        const messageId = getRandomId();
        Http.addStepFunctionEvent(messageId);
        const modifiedData = Object.assign(data, {
            [LUMIGO_EVENT_KEY]: { [STEP_FUNCTION_UID_KEY]: messageId },
        });
        logger.debug(`Added key ${LUMIGO_EVENT_KEY} to the user's return value`);
        return { err, type, data: modifiedData };
    })() || handlerReturnValue);
};
// we wrap the unhandledRejection method to send the function span before the process ends
export const hookUnhandledRejection = (functionSpan) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore - we're overriding an accessor we usually shouldn't have access to
    const events = process._events;
    const { unhandledRejection } = events;
    const originalUnhandledRejection = unhandledRejection;
    events.unhandledRejection = (reason, promise) => __awaiter(void 0, void 0, void 0, function* () {
        const err = Error(reason);
        err.name = 'Runtime.UnhandledPromiseRejection';
        try {
            err.stack = removeLumigoFromError(err.stack);
        }
        catch (errFromRemoveLumigo) {
            logger.warn('Failed to remove Lumigo from stacktrace', errFromRemoveLumigo);
        }
        yield endTrace(functionSpan, {
            err: err,
            type: ASYNC_HANDLER_REJECTED,
            data: null,
        }).then(() => {
            if (typeof originalUnhandledRejection === 'function') {
                originalUnhandledRejection(reason, promise);
            }
        });
    });
});
const setupTimeoutTimer = () => {
    logger.debug('Timeout timer set-up started');
    const { context } = TracerGlobals.getHandlerInputs();
    if (isAwsContext(context)) {
        const { remainingTimeInMillis } = getContextInfo(context);
        const timeoutBuffer = getTimeoutTimerBuffer();
        const minDuration = getTimeoutMinDuration();
        if (timeoutBuffer < remainingTimeInMillis && remainingTimeInMillis >= minDuration) {
            GlobalTimer.setGlobalTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                logger.debug('Invocation is about to timeout, sending trace data.');
                yield sendSpans(SpansContainer.getSpans());
                SpansContainer.clearSpans();
            }), remainingTimeInMillis - timeoutBuffer);
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
const performPromisifyType = (err, data, type, callback) => {
    switch (type) {
        case HANDLER_CALLBACKED:
            callback(err, data);
            break;
        case ASYNC_HANDLER_RESOLVED:
            return data;
        case NON_ASYNC_HANDLER_ERRORED:
        case ASYNC_HANDLER_REJECTED:
            throw err;
    }
};
