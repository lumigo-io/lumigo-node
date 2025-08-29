var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { BaseHttp } from './baseHttp';
import * as logger from '../logger';
import { getEventEntitySize, safeExecuteAsync } from '../utils';
export class FetchInstrumentation {
    /**
     * Starts the fetch instrumentation by attaching the hooks to the fetch function.
     * Note: safe to call even if the fetch instrumentation was already started / fetch is not available.
     */
    static startInstrumentation() {
        if (FetchInstrumentation.libAvailable()) {
            logger.debug('fetch available, attaching instrumentation hooks');
            FetchInstrumentation.attachHooks();
        }
        else {
            logger.debug('Fetch not available, skipping instrumentation');
        }
    }
    /**
     * Stops the fetch instrumentation by removing the hooks from the fetch function.
     * Note: safe to call even if the fetch instrumentation was not started / fetch is not available.
     */
    static stopInstrumentation() {
        if (!FetchInstrumentation.libAvailable()) {
            logger.debug('Fetch not available, can not stop instrumentation');
            return;
        }
        FetchInstrumentation.removeHooks();
    }
    /**
     * Checks if the fetch command is available in the current environment (Native to node from version 18 and above)
     * @returns {boolean} True if available, false otherwise
     * @private
     */
    static libAvailable() {
        // @ts-ignore
        return typeof fetch === 'function';
    }
    /**
     * Attaches the instrumentation hooks to the fetch function.
     * If the hooks are already attached, this function will do nothing.
     * @private
     */
    static attachHooks() {
        // @ts-ignore
        if (fetch.__originalFetch) {
            logger.debug('Fetch instrumentation hooks already attached');
            return;
        }
        // @ts-ignore
        const originalFetch = fetch;
        // @ts-ignore
        fetch = (input, init) => __awaiter(this, void 0, void 0, function* () {
            const extenderContext = {};
            const safeBeforeFetch = safeExecuteAsync({
                fn: FetchInstrumentation.beforeFetch,
                message: 'Fetch instrumentation - before fetch function call',
                logLevel: logger.LOG_LEVELS.WARNING,
                defaultReturn: {
                    input,
                    init,
                },
            });
            const modifiedArgs = yield safeBeforeFetch({ input, init, extenderContext });
            try {
                // @ts-ignore
                const response = yield originalFetch(modifiedArgs.input, modifiedArgs.init);
                extenderContext.response = response;
                const safeCreateResponseSpan = safeExecuteAsync({
                    fn: FetchInstrumentation.createResponseSpan,
                    message: 'Fetch instrumentation - create response span',
                    defaultReturn: response,
                });
                yield safeCreateResponseSpan(extenderContext);
                return response;
            }
            catch (error) {
                const safeCreateResponseSpan = safeExecuteAsync({
                    fn: FetchInstrumentation.createResponseSpan,
                    message: 'Fetch instrumentation - create response span',
                });
                yield safeCreateResponseSpan(extenderContext);
                throw error;
            }
        });
        // @ts-ignore
        fetch.__originalFetch = originalFetch;
    }
    static removeHooks() {
        // @ts-ignore
        if (fetch.__originalFetch) {
            // @ts-ignore
            fetch = fetch.__originalFetch;
        }
    }
    /**
     * Runs before the fetch command is executed
     * @param args
     * @param {RequestInfo | URL} args.input The first argument (called input / resource) that is passed to the fetch command
     * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
     * @param {RequestExtenderContext} args.extenderContext The extender context object that will be used to pass data between the instrumentation functions running before & after the fetch command
     * @returns {Promise<FetchArguments | undefined>} The modified fetch arguments with the headers added from the args.options object, or undefined if the request should not be traced
     */
    static beforeFetch(_a) {
        return __awaiter(this, arguments, void 0, function* ({ input, init, extenderContext, }) {
            logger.debug('Fetch instrumentor - before fetch function call', {
                input,
                init,
                extenderContext,
            });
            const originalArgs = { input, init };
            extenderContext.isTracedDisabled = true;
            const { url, options } = yield FetchInstrumentation.parseRequestArguments(originalArgs);
            const requestTracingData = BaseHttp.onRequestCreated({
                options,
                url,
            });
            logger.debug('Fetch instrumentor - parsed request data', { requestTracingData });
            if (!requestTracingData) {
                return originalArgs;
            }
            const { addedHeaders, headers, requestRandomId, awsRequestId, transactionId, httpSpan = undefined, requestData = undefined, } = requestTracingData;
            BaseHttp.aggregateRequestBodyToSpan(options.body, requestData, httpSpan, getEventEntitySize(true));
            extenderContext.awsRequestId = awsRequestId;
            extenderContext.transactionId = transactionId;
            extenderContext.requestRandomId = requestRandomId;
            if (requestData) {
                extenderContext.requestData = requestData;
            }
            if (httpSpan) {
                extenderContext.currentSpan = httpSpan;
            }
            let modifiedArgs = Object.assign({}, originalArgs);
            if (addedHeaders) {
                options.headers = headers;
                modifiedArgs = FetchInstrumentation.addHeadersToFetchArguments(Object.assign(Object.assign({}, modifiedArgs), { options }));
            }
            extenderContext.isTracedDisabled = false;
            return modifiedArgs;
        });
    }
    /**
     * Runs when the fetch response promise is resolved. This function will read the response body and record the data.
     * All the additional parameters are extracted from the extender context object.
     * @param {RequestExtenderContext} args
     * @param {string} args.transactionId The transaction id of the request
     * @param {string} args.awsRequestId The AWS request ID of the current lambda invocation
     * @param {RequestData} args.requestData The request data object
     * @param {string} args.requestRandomId The random ID of the request
     * @param {Response} args.response The response object returned by the fetch promise
     * @private
     */
    static createResponseSpan(_a) {
        return __awaiter(this, arguments, void 0, function* ({ transactionId, awsRequestId, requestData, requestRandomId, response, }) {
            if (!response) {
                return;
            }
            const clonedResponse = response.clone();
            const responseData = FetchInstrumentation.convertResponseToResponseData(clonedResponse);
            const responseDataWriterHandler = BaseHttp.createResponseDataWriterHandler({
                transactionId,
                awsRequestId,
                requestData,
                requestRandomId,
                response: responseData,
            });
            const bodyText = yield clonedResponse.text();
            responseDataWriterHandler(['data', bodyText]);
            responseDataWriterHandler(['end']);
        });
    }
    /**
     * Parses the raw arguments passed to the fetch function and returns the URL and options object.
     * @param {FetchArguments} args The raw fetch arguments
     * @param {RequestInfo | URL} args.input The first argument (called input / resource) that is passed to the fetch command
     * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
     * @returns {UrlAndRequestOptions} Our custom request options object containing the URL and options
     * @private
     */
    static parseRequestArguments(_a) {
        return __awaiter(this, arguments, void 0, function* ({ input, init, }) {
            let url = undefined;
            const options = {
                headers: {},
                method: 'GET',
            };
            if (input instanceof URL) {
                url = input.toString();
            }
            else if (typeof input === 'string') {
                url = input;
                // @ts-ignore
            }
            else if (input instanceof Request) {
                url = input.url;
                options.method = input.method || 'GET';
                options.headers = FetchInstrumentation.convertHeadersToKeyValuePairs(input.headers);
            }
            if (init) {
                options.method = init.method || options.method || 'GET';
                options.headers = Object.assign(Object.assign({}, options.headers), FetchInstrumentation.convertHeadersToKeyValuePairs(init.headers));
            }
            // Read the body from the request object, only if we shouldn't look in the init object
            let body = undefined;
            try {
                // @ts-ignore
                if (input instanceof Request && input.body && !(init === null || init === void 0 ? void 0 : init.body)) {
                    body = yield input.clone().text();
                }
            }
            catch (e) {
                logger.debug('Failed to read body from Request object', e);
            }
            // If we didn't get the body from the request object, get it from the init object
            if (!body && (init === null || init === void 0 ? void 0 : init.body)) {
                try {
                    // @ts-ignore
                    const decoder = new TextDecoder();
                    // @ts-ignore
                    if (init.body instanceof ReadableStream) {
                        const reader = init.body.getReader();
                        let result = '';
                        // Limiting the number of reads to prevent an infinite read loop
                        for (let i = 0; i < 10000; i++) {
                            const { done, value } = yield reader.read();
                            if (done) {
                                break;
                            }
                            result += decoder.decode(value);
                        }
                        body = result;
                        // @ts-ignore
                    }
                    else if (init.body instanceof Blob) {
                        body = yield init.body.text();
                    }
                    else if (init.body instanceof ArrayBuffer) {
                        body = decoder.decode(init.body);
                    }
                    else if (typeof init.body === 'string') {
                        body = init.body;
                    }
                    else {
                        // TODO: Implement FormData support
                        logger.debug('Unsupported request body type', typeof init.body);
                    }
                }
                catch (e) {
                    logger.debug('Failed to read request body from Request object', {
                        error: e,
                        bodyObjectType: typeof init.body,
                    });
                }
            }
            if (body) {
                options.body = body;
            }
            return { url, options };
        });
    }
    /**
     * Converts the headers object to a key-value pair object.
     * Fetch library uses multiple format to represent headers, this function will convert them all to a key-value pair object.
     * @param {[string, string][] | Record<string, string> | Headers} headers Headers object as used by the fetch library
     * @returns {Record<string, string>} The headers as a key-value pair object
     * @private
     */
    static convertHeadersToKeyValuePairs(
    // @ts-ignore
    headers) {
        // @ts-ignore
        if (headers instanceof Headers) {
            const headersObject = {};
            headers.forEach((value, key) => {
                headersObject[key] = value;
            });
            return headersObject;
        }
        if (Array.isArray(headers)) {
            const headersObject = {};
            headers.forEach(([key, value]) => {
                headersObject[key] = value;
            });
            return headersObject;
        }
        return headers;
    }
    /**
     * Adds the headers found in the options object to the fetch arguments, and return the modified arguments.
     * The original arguments will not be modified.
     * @param {FetchArguments} args The original fetch arguments
     * @param {ParseHttpRequestOptions} args.input The first argument (called input / resource) that is passed to the fetch command
     * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
     * @param {ParseHttpRequestOptions} args.options Our custom request options object containing the headers to add to the fetch arguments
     * @returns {FetchArguments} The modified fetch arguments with the headers added from the args.options object
     */
    static addHeadersToFetchArguments({ input, init, options, }) {
        // The init headers take precedence over the input headers
        // @ts-ignore
        const newInit = init ? Object.assign({}, init) : {};
        if (options.headers) {
            const currentHeaders = newInit.headers || {};
            newInit.headers = Object.assign(Object.assign({}, currentHeaders), options.headers);
        }
        return { input, init: newInit };
    }
    /**
     * Converts the fetch response object instance to a custom response data object used by the rest of the lumigo tracer codebase.
     * @param {Response} response
     * @returns {ResponseData}
     * @private
     */
    // @ts-ignore
    static convertResponseToResponseData(response) {
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        return {
            headers,
            statusCode: response.status,
        };
    }
}
