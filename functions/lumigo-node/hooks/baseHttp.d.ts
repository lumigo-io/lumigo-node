import { BasicChildSpan } from '../types/spans/basicSpan';
import { Agent } from './http';
export declare const hostBlacklist: Set<string>;
export type HttpRequestTracingConfig = {
    headers: {};
    addedHeaders: {};
    httpSpan?: BasicChildSpan;
    requestData?: RequestData;
    requestRandomId: string;
    awsRequestId: string;
    transactionId: string;
};
export type ParseHttpRequestOptions = {
    agent?: Agent;
    _defaultAgent?: Agent;
    headers?: Record<string, string>;
    method?: string;
    protocol?: string;
    path?: string;
    port?: number;
    defaultPort?: number;
    hostname?: string;
    host?: string;
    uri?: {
        hostname?: string;
    };
};
export type UrlAndRequestOptions = {
    url: string;
    options: ParseHttpRequestOptions;
};
export type RequestData = {
    host?: string;
    body?: any;
    headers?: any;
    path?: string;
    truncated?: boolean;
    port?: number;
    uri?: string;
    method?: string;
    protocol?: string;
    sendTime?: number;
};
export type ResponseData = {
    headers?: Record<string, string>;
    statusCode?: number;
    body?: string;
    receivedTime?: number;
    truncated?: boolean;
    isNetworkError?: boolean;
};
export type httpRequestCreatedParams = {
    options?: ParseHttpRequestOptions;
    url?: string;
};
export declare class BaseHttp {
    /**
     * Starts an HTTP request tracing span
     * @param {ParseHttpRequestOptions} options Parameters about the new http request that is being triggered
     * @param {string} url The URL of the new http request that is being triggered
     * @returns {HttpRequestTracingConfig} The newly created span, and information required for altering the http request
     */
    static onRequestCreated({ options, url, }: httpRequestCreatedParams): HttpRequestTracingConfig | undefined;
    static _getHostFromOptionsOrUrl({ options, url }: httpRequestCreatedParams): string;
    /**
     * Returns a handler that should be called every time request body data is sent to the server.
     * This handler will collect the request body and add it to the current span.
     * @param {{body: string}} requestData The request data object that will be updated with the request body in place
     * @param {BasicChildSpan} currentSpan The span of the current HTTP request, will be updated in place
     * @returns {(args: any[]) => void} A handler that should be called everytime request body data is sent to the server,
     *  with a list of arguments. The handler will update the current span with the new request data.
     *  The input arguments are (by index):
     *  [0] - The data that was sent, can be a string, buffer or any other type that can be converted to a string.
     *  [1] - The encoding of the data, default is 'utf8' if no encoding / unknown encoding is given.
     */
    static createRequestDataWriteHandler({ requestData, currentSpan, }: {
        requestData: RequestData;
        currentSpan?: BasicChildSpan;
    }): Function;
    /**
     * Returns a handler that should be called every time request body data is sent to the server,
     * in cases where the data is written on the socket level.
     * @param {{body: string}} requestData The request data object that will be updated with the request body in place
     * @param {BasicChildSpan} currentSpan The span of the current HTTP request, will be updated in place
     * @returns {Function} A handler that should be called everytime request body data is sent to the server,
     *  with a list of arguments. The handler will update the current span with the new request data.
     *  The input is a docket event object.
     */
    static createRequestSocketDataWriteHandler({ requestData, currentSpan, }: {
        requestData: RequestData;
        currentSpan?: BasicChildSpan;
    }): Function;
    /**
     * Returns a handler that should be called every time response data is received from the server.
     * This handler will collect the response data and add it to a new span once all the response data is received.
     * @param {string} transactionId The current transaction id
     * @param {string} awsRequestId The current AWS request id
     * @param {{body: string}} requestData The current request data. Will be updated in place when the http span is finalized.
     * @param {string} requestRandomId IDK
     * @param {{headers: {}, statusCode: number}} response Details about the http response. Will be updated in place.
     * @returns {(args: any[]) => void} Handler that should be called every time response data is received from the server.
     *  The handler will update the current request data with the response data and create a new span for the response.
     *  The input arguments are (by index):
     *  [0] - The type of the response data, can be 'data' (loading a data chunk from the response) or 'end' (finished loading all response data chunks).
     *  [1] - The data that was received, can be a string, buffer or any other type that can be converted to a string.
     */
    static createResponseDataWriterHandler({ transactionId, awsRequestId, requestData, requestRandomId, response, }: {
        transactionId: string;
        awsRequestId: string;
        requestData: RequestData;
        requestRandomId: string;
        response: ResponseData;
    }): (args: any[]) => {
        truncated: boolean;
    };
    static isBlacklisted(host: string): boolean;
    static aggregateRequestBodyToSpan(body: string, requestData: RequestData, currentSpan: BasicChildSpan, maxSize?: number): void;
    static parseHttpRequestOptions(options?: ParseHttpRequestOptions, url?: string): RequestData;
    static scrubQueryParams(search: string): string;
}
