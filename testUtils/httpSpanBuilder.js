import { lowerCaseObjectKeys } from '../src/utils';
import { payloadStringify } from '../src/utils/payloadStringify';

export class HttpSpanBuilder {
  static DEFAULT_ACCOUNT = '985323015126';
  static DEFAULT_REGION = 'us-east-1';
  static DEFAULT_FUNC_NAME = 'aws-nodejs-dev-hello';
  static DEFAULT_TRANSACTION_ID = '64a1b06067c2100c52e51ef4';
  static DEFAULT_TRACE_ID = {
    Parent: '28effe37598bb622',
    Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
    Sampled: '0',
    transactionId: '64a1b06067c2100c52e51ef4',
  };

  static DEFAULT_TRACER = {
    name: '@lumigo/tracerMock',
    version: '1.2.3',
  };

  static DEFAULT_ARN = `arn:aws:lambda:${HttpSpanBuilder.DEFAULT_REGION}:${HttpSpanBuilder.DEFAULT_ACCOUNT}:function:${HttpSpanBuilder.DEFAULT_FUNC_NAME}`;
  static DEFAULT_VERSION = '1';

  static DEFAULT_HOST = 'lumigo.io';
  static DEFAULT_PARENT_ID = '6d26e3c8-60a6-4cee-8a70-f525f47a4caf';

  static DEFAULT_REQUEST_DATA = {
    host: HttpSpanBuilder.DEFAULT_HOST,
    headers: { X: 'Y', host: 'lumigo.io' },
    method: 'GET',
    path: '/',
    port: 80,
    protocol: 'http:',
    uri: `${HttpSpanBuilder.DEFAULT_HOST}/`,
  };

  static cloneResponse = data => {
    return JSON.parse(JSON.stringify(data));
  };

  static getDefaultData = data => {
    return HttpSpanBuilder.cloneResponse(data);
  };

  constructor() {
    this._span = {
      account: HttpSpanBuilder.DEFAULT_ACCOUNT,
      ended: 1256,
      id: 'not-a-random-id',
      info: {
        httpInfo: {
          host: HttpSpanBuilder.DEFAULT_HOST,
          request: {
            body: '"the first rule of fight club"',
            headers: '{"Tyler":"Durden"}',
            host: HttpSpanBuilder.DEFAULT_HOST,
            sendTime: 1234,
          },
          response: {},
        },
        logGroupName: `/aws/lambda/${HttpSpanBuilder.DEFAULT_FUNC_NAME}`,
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        traceId: HttpSpanBuilder.DEFAULT_TRACE_ID,
        tracer: HttpSpanBuilder.DEFAULT_TRACER,
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      parentId: HttpSpanBuilder.DEFAULT_PARENT_ID,
      reporterAwsRequestId: HttpSpanBuilder.DEFAULT_PARENT_ID,
      readiness: 'cold',
      region: HttpSpanBuilder.DEFAULT_REGION,
      invokedArn: HttpSpanBuilder.DEFAULT_ARN,
      invokedVersion: HttpSpanBuilder.DEFAULT_VERSION,
      runtime: 'AWS_Lambda_nodejs8.10',
      service: 'external',
      started: 1234,
      token: '',
      transactionId: HttpSpanBuilder.DEFAULT_TRANSACTION_ID,
      type: 'http',
      vendor: 'AWS',
      version: '$LATEST',
    };
  }

  static parseHeaders = headers => payloadStringify(lowerCaseObjectKeys(headers));

  static parseBody = body => {
    if (!body) body = '';
    return payloadStringify(body);
  };

  static addHeader = (headers, obj) => {
    let newHeaders = JSON.parse(headers);
    newHeaders = { ...newHeaders, ...obj };
    return JSON.stringify(newHeaders);
  };

  withSpanId = spanId => {
    this._span.id = spanId;
    return this;
  };

  withResponse = response => {
    this._span.info.httpInfo.response = { ...response };
    this._span.info.httpInfo.response.headers = HttpSpanBuilder.parseHeaders(
      this._span.info.httpInfo.response.headers
    );
    this._span.info.httpInfo.response.body = HttpSpanBuilder.parseBody(
      this._span.info.httpInfo.response.body
    );
    return this;
  };

  withHost = host => {
    this._span.info.httpInfo.request.host = host;
    this._span.info.httpInfo.host = host;

    const headers = HttpSpanBuilder.addHeader(this._span.info.httpInfo.request.headers, { host });
    this._span.info.httpInfo.request.headers = headers;
    return this;
  };

  withRequest = request => {
    this._span.info.httpInfo.request = { ...request };
    this._span.info.httpInfo.request.headers = HttpSpanBuilder.parseHeaders(
      this._span.info.httpInfo.request.headers
    );
    this._span.info.httpInfo.request.body = HttpSpanBuilder.parseBody(
      this._span.info.httpInfo.request.body
    );
    return this.withHost(request.host);
  };

  withInvokedArn = invokedArn => {
    this._span.invokedArn = invokedArn;
    return this;
  };

  withParentId = parentId => {
    this._span.parentId = parentId;
    return this;
  };

  withReporterAwsRequestId = reporterAwsRequestId => {
    this._span.reporterAwsRequestId = reporterAwsRequestId;
    return this;
  };

  withAccountId = accountId => {
    this._span.account = accountId;
    return this;
  };

  withWarm = () => {
    this._span.readiness = 'warm';
    return this;
  };

  withEnded = ended => {
    this._span.ended = ended;
    return this;
  };

  withStarted = started => {
    this._span.started = started;
    return this;
  };

  withHttpInfo = httpInfo => {
    this._span.info.httpInfo = httpInfo;
    this._span.info.httpInfo.request && this.withRequest(this._span.info.httpInfo.request);
    this._span.info.httpInfo.response && this.withResponse(this._span.info.httpInfo.response);
    return this;
  };

  withNoResponse = () => {
    this._span.info.httpInfo.response = {};
    return this;
  };

  withRequestTimesFromSpan = span => {
    const httpInfo = this._span.info.httpInfo;
    httpInfo.request.sendTime = span.info.httpInfo.request.sendTime;
    if (span.info.httpInfo?.response?.receivedTime) {
      if (!httpInfo.response) httpInfo.response = {};
      httpInfo.response.receivedTime = span.info.httpInfo.response.receivedTime;
    }
    return this;
  };

  build = () => this._span;
}
