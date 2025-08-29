export declare class FetchInstrumentation {
    /**
     * Starts the fetch instrumentation by attaching the hooks to the fetch function.
     * Note: safe to call even if the fetch instrumentation was already started / fetch is not available.
     */
    static startInstrumentation(): void;
    /**
     * Stops the fetch instrumentation by removing the hooks from the fetch function.
     * Note: safe to call even if the fetch instrumentation was not started / fetch is not available.
     */
    static stopInstrumentation(): void;
    /**
     * Checks if the fetch command is available in the current environment (Native to node from version 18 and above)
     * @returns {boolean} True if available, false otherwise
     * @private
     */
    private static libAvailable;
    /**
     * Attaches the instrumentation hooks to the fetch function.
     * If the hooks are already attached, this function will do nothing.
     * @private
     */
    private static attachHooks;
    private static removeHooks;
    /**
     * Runs before the fetch command is executed
     * @param args
     * @param {RequestInfo | URL} args.input The first argument (called input / resource) that is passed to the fetch command
     * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
     * @param {RequestExtenderContext} args.extenderContext The extender context object that will be used to pass data between the instrumentation functions running before & after the fetch command
     * @returns {Promise<FetchArguments | undefined>} The modified fetch arguments with the headers added from the args.options object, or undefined if the request should not be traced
     */
    private static beforeFetch;
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
    private static createResponseSpan;
    /**
     * Parses the raw arguments passed to the fetch function and returns the URL and options object.
     * @param {FetchArguments} args The raw fetch arguments
     * @param {RequestInfo | URL} args.input The first argument (called input / resource) that is passed to the fetch command
     * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
     * @returns {UrlAndRequestOptions} Our custom request options object containing the URL and options
     * @private
     */
    private static parseRequestArguments;
    /**
     * Converts the headers object to a key-value pair object.
     * Fetch library uses multiple format to represent headers, this function will convert them all to a key-value pair object.
     * @param {[string, string][] | Record<string, string> | Headers} headers Headers object as used by the fetch library
     * @returns {Record<string, string>} The headers as a key-value pair object
     * @private
     */
    private static convertHeadersToKeyValuePairs;
    /**
     * Adds the headers found in the options object to the fetch arguments, and return the modified arguments.
     * The original arguments will not be modified.
     * @param {FetchArguments} args The original fetch arguments
     * @param {ParseHttpRequestOptions} args.input The first argument (called input / resource) that is passed to the fetch command
     * @param {RequestInit} args.init The second argument (called init / options) that is passed to the fetch command
     * @param {ParseHttpRequestOptions} args.options Our custom request options object containing the headers to add to the fetch arguments
     * @returns {FetchArguments} The modified fetch arguments with the headers added from the args.options object
     */
    private static addHeadersToFetchArguments;
    /**
     * Converts the fetch response object instance to a custom response data object used by the rest of the lumigo tracer codebase.
     * @param {Response} response
     * @returns {ResponseData}
     * @private
     */
    private static convertResponseToResponseData;
}
