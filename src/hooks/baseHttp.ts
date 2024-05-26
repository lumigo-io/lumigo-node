import { SpansContainer, TracerGlobals } from '../globals';
import {
  getCurrentTransactionId,
  getHttpInfo,
  getHttpSpan,
  getServiceData,
  ServiceData,
} from '../spans/awsSpan';
import {
  addHeaders,
  getAWSEnvironment,
  getEdgeHost,
  getEventEntitySize,
  getPatchedTraceId,
  getRandomId,
  isAwsService,
  isEmptyString,
  isKeepHeadersOn,
  isTimeoutTimerEnabled,
  isValidAlias,
  lowerCaseObjectKeys,
  safeExecute,
  shouldPropagateW3C,
} from '../utils';
import { GlobalDurationTimer } from '../utils/globalDurationTimer';
import * as logger from '../logger';
import { BasicChildSpan } from '../types/spans/basicSpan';
import { getW3CTracerPropagatorAdditionalHeaders } from '../utils/w3cUtils';
import {
  extractBodyFromEmitSocketEvent,
  extractBodyFromWriteOrEndFunc,
  httpDataToString,
} from './httpUtils';
import { URL } from 'url';
import { parse as parseQuery } from 'querystring';
import { shallowMask } from '../utils/payloadStringify';
import { Agent } from './http';

export const hostBlacklist = new Set(['127.0.0.1']);

export type HttpRequestTracingConfig = {
  // Headers of the request, including user defined headers & added headers
  headers: {};

  // Headers added to the original headers
  addedHeaders: {};

  // The HTTP span that was created for this request (Will be updated in place in the request response lifecycle)
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
  uri?: { hostname?: string };
};

// I would have just added the url to the options object, but kept it as is, so we don't break existing code
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
  // The time when all the response data was received, including all the body chunks
  receivedTime?: number;
  truncated?: boolean;
  isNetworkError?: boolean;
};

export type httpRequestCreatedParams = {
  options?: ParseHttpRequestOptions;
  url?: string;
};

export class BaseHttp {
  /**
   * Starts an HTTP request tracing span
   * @param {ParseHttpRequestOptions} options Parameters about the new http request that is being triggered
   * @param {string} url The URL of the new http request that is being triggered
   * @returns {HttpRequestTracingConfig} The newly created span, and information required for altering the http request
   */
  static onRequestCreated({
    options,
    url,
  }: httpRequestCreatedParams): HttpRequestTracingConfig | undefined {
    // Gather basic info for creating the HTTP span
    const host = BaseHttp._getHostFromOptionsOrUrl({ options, url });
    const headers = options.headers || {};
    options.headers = headers;
    const addedHeaders = {};
    const { awsRequestId } = TracerGlobals.getHandlerInputs().context;
    const transactionId = getCurrentTransactionId();
    const requestRandomId = getRandomId();

    const shouldIgnoreReq =
      BaseHttp.isBlacklisted(host) || !isValidAlias() || GlobalDurationTimer.isTimePassed();
    if (shouldIgnoreReq) {
      return undefined;
    }

    logger.debug('Starting hook', { host, url, headers });

    const returnData: HttpRequestTracingConfig = {
      addedHeaders,
      headers,
      requestRandomId,
      awsRequestId,
      transactionId,
    };

    const isRequestToAwsService = isAwsService(host);
    if (isRequestToAwsService && !isKeepHeadersOn()) {
      const { awsXAmznTraceId } = getAWSEnvironment();
      addedHeaders['X-Amzn-Trace-Id'] = getPatchedTraceId(awsXAmznTraceId);
    }

    if (shouldPropagateW3C()) {
      safeExecute(() => {
        Object.assign(addedHeaders, getW3CTracerPropagatorAdditionalHeaders(headers));
      })();
    }

    if (addedHeaders) {
      Object.assign(headers, addedHeaders);
      options.headers = headers;
    }

    const requestData = BaseHttp.parseHttpRequestOptions(options, url);
    returnData.requestData = requestData;

    if (isTimeoutTimerEnabled()) {
      const httpSpan = getHttpSpan(transactionId, awsRequestId, requestRandomId, requestData);
      SpansContainer.addSpan(httpSpan);
      returnData.httpSpan = httpSpan;
    }
    return returnData;
  }

  @GlobalDurationTimer.timedSync()
  static _getHostFromOptionsOrUrl({ options, url = undefined }: httpRequestCreatedParams) {
    if (url) {
      return new URL(url).hostname;
    }
    if (options) {
      return (
        options.hostname || options.host || (options.uri && options.uri.hostname) || 'localhost'
      );
    }

    return 'localhost';
  }

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
  static createRequestDataWriteHandler({
    requestData,
    currentSpan = undefined,
  }: {
    requestData: RequestData;
    currentSpan?: BasicChildSpan;
  }): Function {
    return function (args: any[]) {
      GlobalDurationTimer.start();

      // If we already loaded the body / part of it we don't want to load it again (The first chunk is enough for us)
      if (isEmptyString(requestData.body)) {
        const body = extractBodyFromWriteOrEndFunc(args);
        BaseHttp.aggregateRequestBodyToSpan(
          body,
          requestData,
          currentSpan,
          getEventEntitySize(true)
        );
      }
      GlobalDurationTimer.stop();
    };
  }

  /**
   * Returns a handler that should be called every time request body data is sent to the server,
   * in cases where the data is written on the socket level.
   * @param {{body: string}} requestData The request data object that will be updated with the request body in place
   * @param {BasicChildSpan} currentSpan The span of the current HTTP request, will be updated in place
   * @returns {Function} A handler that should be called everytime request body data is sent to the server,
   *  with a list of arguments. The handler will update the current span with the new request data.
   *  The input is a docket event object.
   */
  static createRequestSocketDataWriteHandler({
    requestData,
    currentSpan = undefined,
  }: {
    requestData: RequestData;
    currentSpan?: BasicChildSpan;
  }): Function {
    return function (socketEventArgs: {}) {
      GlobalDurationTimer.start();
      if (isEmptyString(requestData.body)) {
        const body = extractBodyFromEmitSocketEvent(socketEventArgs);
        BaseHttp.aggregateRequestBodyToSpan(
          body,
          requestData,
          currentSpan,
          getEventEntitySize(true)
        );
      }
      GlobalDurationTimer.stop();
    };
  }

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
  static createResponseDataWriterHandler({
    transactionId,
    awsRequestId,
    requestData,
    requestRandomId,
    response,
  }: {
    transactionId: string;
    awsRequestId: string;
    requestData: RequestData;
    requestRandomId: string;
    response: ResponseData;
  }): (args: any[]) => { truncated: boolean } {
    let body = '';
    const { headers, statusCode } = response;
    const maxPayloadSize = getEventEntitySize(isErroneousResponse(response));
    let truncated = false;
    return function (args: any[]): { truncated: boolean } {
      GlobalDurationTimer.start();
      const receivedTime = new Date().getTime();
      // add to body only if we didn't pass the max size
      if (args[0] === 'data' && body.length < maxPayloadSize) {
        let chunk = httpDataToString(args[1]);
        const allowedLengthToAdd = maxPayloadSize - body.length;
        //if we reached or close to limit get only substring of the part to reach the limit
        if (chunk.length > allowedLengthToAdd) {
          truncated = true;
          chunk = chunk.substr(0, allowedLengthToAdd);
        }
        body += chunk;
      }
      if (args[0] === 'end') {
        const responseData: ResponseData = {
          statusCode,
          receivedTime,
          body,
          headers: lowerCaseObjectKeys(headers),
        };
        const httpSpan = getHttpSpan(transactionId, awsRequestId, requestRandomId, requestData, {
          ...responseData,
          truncated,
        });
        if (httpSpan.id !== requestRandomId) {
          // In Http case, one of our parser decide to change the spanId for async connection
          SpansContainer.changeSpanId(requestRandomId, httpSpan.id);
        }
        SpansContainer.addSpan(httpSpan);
      }
      GlobalDurationTimer.stop();

      return {
        truncated,
      };
    };
  }

  static isBlacklisted(host: string): boolean {
    return host === getEdgeHost() || hostBlacklist.has(host);
  }

  static aggregateRequestBodyToSpan(
    body: string,
    requestData: RequestData,
    currentSpan: BasicChildSpan,
    maxSize: number = getEventEntitySize(true)
  ): void {
    let serviceData: ServiceData = {};
    if (body && !requestData.truncated && typeof body === 'string') {
      requestData.body += body;
      serviceData = getServiceData(requestData, null);
      const truncated = maxSize < requestData.body.length;
      if (truncated) requestData.body = requestData.body.substr(0, maxSize);
      requestData.truncated = truncated;
    }
    if (currentSpan) {
      // @ts-ignore
      currentSpan.info.httpInfo = getHttpInfo(requestData, {});
      Object.assign(currentSpan.info, {
        ...serviceData.awsServiceData,
      });
    }
  }

  @GlobalDurationTimer.timedSync()
  static parseHttpRequestOptions(options: ParseHttpRequestOptions = {}, url?: string): RequestData {
    const host = BaseHttp._getHostFromOptionsOrUrl({ options, url });
    const agent = options.agent || options._defaultAgent;

    let path = null;
    let port = null;
    let search = null;
    let protocol = null;

    const { headers, method = 'GET' } = options;
    const sendTime = new Date().getTime();

    if (url) {
      const myUrl = new URL(url);
      ({ pathname: path, port, protocol, search } = myUrl);
    } else {
      path = options.path || '/';
      port = options.port || options.defaultPort || (agent && agent.defaultPort) || 80;
      protocol = options.protocol || (port === 443 && 'https:') || 'http:';
    }

    const modifiedHeaders = headers && !headers.host ? addHeaders(headers, { host }) : headers;

    if (!!search) {
      search = BaseHttp.scrubQueryParams(search);
    } else {
      search = '';
    }

    const uri = `${host}${path}${search}`;

    return {
      truncated: false,
      path,
      port,
      uri,
      host,
      body: '', // Filled by the httpRequestEndWrapper or httpRequestEmitBeforeHookWrapper ( / Write)
      method,
      headers: lowerCaseObjectKeys(modifiedHeaders),
      protocol,
      sendTime,
    };
  }

  static scrubQueryParams(search: string): string {
    return (
      safeExecute(() => {
        const query = parseQuery(search.substring(1));
        const scrubbedQuery = shallowMask('queryParams', query);
        return '?' + new URLSearchParams(scrubbedQuery);
      })() || ''
    );
  }
}

function isErroneousResponse(responseData: ResponseData): boolean {
  return responseData.isNetworkError || responseData.statusCode >= 400;
}
