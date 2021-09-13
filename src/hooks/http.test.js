import { lowerCaseObjectKeys } from '../utils';
import EventEmitter from 'events';
import MockDate from 'mockdate';
import * as shimmer from 'shimmer';
import { HttpSpanBuilder } from '../../testUtils/httpSpanBuilder';
import {
  HttpsMocker,
  HttpsScenarioBuilder,
  HttpsRequestsForTesting,
} from '../../testUtils/httpsMocker';

import * as utils from '../utils';
import { clearGlobals, SpansContainer, TracerGlobals } from '../globals';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';
import { getCurrentTransactionId } from '../spans/awsSpan';
import { Http } from './http';

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';
  process.env['_X_AMZN_TRACE_ID'] =
    'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';

  const spies = {};
  spies.shimmer = jest.spyOn(shimmer, 'wrap');

  beforeEach(() => {
    spies.shimmer.mockClear();
    shimmer.unwrap(HttpsMocker, 'request');
  });

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    TracerGlobals.setTracerInputs({ ...TracerGlobals.getTracerInputs(), edgeHost });
    expect(Http.isBlacklisted(host)).toBe(false);
    expect(Http.isBlacklisted(edgeHost)).toBe(true);
  });

  test('httpRequestEmitBeforeHookWrapper -> outputData flow', () => {
    const requestData = {
      body: '',
    };
    const randomRequstId = 'REQ';
    const awsRequestId = HttpSpanBuilder.DEFAULT_PARENT_ID;
    const transactionId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
    const wrapper = Http.httpRequestEmitBeforeHookWrapper(
      transactionId,
      awsRequestId,
      requestData,
      randomRequstId
    );
    const emitEventName = 'socket';
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        outputData: [{ data: 'HTTP BODY1\nHTTP BODY2' }],
      },
    };

    wrapper([emitEventName, emitArg]);

    expect(requestData).toEqual({
      body: 'HTTP BODY2',
    });
  });

  test('httpRequestEmitBeforeHookWrapper -> output flow', () => {
    const awsRequestId = HttpSpanBuilder.DEFAULT_PARENT_ID;
    const transactionId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
    const requestData = {
      body: '',
    };
    const emitEventName = 'socket';
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        output: ['HTTP BODY1\nHTTP BODY2'],
      },
    };
    const wrapper = Http.httpRequestEmitBeforeHookWrapper(transactionId, awsRequestId, requestData);
    wrapper([emitEventName, emitArg]);

    expect(requestData).toEqual({
      body: 'HTTP BODY2',
    });
  });

  test('httpRequestEmitBeforeHookWrapper -> not crashed on bad data', () => {
    const requestData = {
      body: '',
    };

    const emitEventName = 'emit';
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        output: 1,
      },
    };

    const wrapper = Http.httpRequestEmitBeforeHookWrapper(requestData);
    wrapper(emitEventName, emitArg);

    expect(requestData).toEqual({ body: '' });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(str)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';

    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    wrapper([firstArg]);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer)', () => {
    const requestData = {
      body: '',
    };
    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    const firstArg = Buffer.from('BODY');

    wrapper([firstArg]);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer, encoding)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';
    const secArg = 'base64';

    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    wrapper([firstArg, secArg]);

    expect(requestData).toEqual({ body: 'Qk9EWQ==' });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer, encoding, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = Buffer.from('BODY');
    const secArg = 'utf8';
    const thirdArg = () => {};

    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    wrapper([firstArg, secArg, thirdArg]);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = Buffer.from('BODY');
    const secArg = () => {};

    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    wrapper([firstArg, secArg]);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(str, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';
    const secArg = () => {};

    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    wrapper([firstArg, secArg]);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteBeforeHookWrapper -> not override body', () => {
    const requestData = {
      body: 'BODY1',
    };

    const firstArg = Buffer.from('BODY2');

    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    wrapper([firstArg]);

    expect(requestData).toEqual({ body: 'BODY1' });
  });

  test('httpRequestWriteBeforeHookWrapper -> not crashed on bad data', () => {
    const requestData = {
      body: '',
    };

    const firstArg = {};
    const secArg = {};

    const wrapper = Http.httpRequestWriteBeforeHookWrapper(requestData);
    wrapper(firstArg, secArg);

    expect(requestData).toEqual({ body: '' });
  });

  test('getHostFromOptionsOrUrl', () => {
    const options1 = { host: 'asdf1.com' };
    const options2 = { hostname: 'asdf2.com' };
    const options3 = { uri: { hostname: 'asdf3.com' } };
    const options4 = {};
    expect(Http.getHostFromOptionsOrUrl(options1)).toEqual('asdf1.com');
    expect(Http.getHostFromOptionsOrUrl(options2)).toEqual('asdf2.com');
    expect(Http.getHostFromOptionsOrUrl(options3)).toEqual('asdf3.com');
    expect(Http.getHostFromOptionsOrUrl(options4)).toEqual('localhost');

    const url1 = 'https://asdf.io:1234/yo?ref=baba';
    expect(Http.getHostFromOptionsOrUrl({}, url1)).toEqual('asdf.io');
  });

  test('parseHttpRequestOptions', () => {
    const headers = { X: 'Y', Z: 'A' };
    const options1 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers,
    };
    const sendTime = 895179612345;
    MockDate.set(sendTime);

    const expectedHeaders = lowerCaseObjectKeys({
      ...headers,
      ...{ host: 'asdf1.com' },
    });

    const expected1 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      uri: 'asdf1.com/api/where/is/satoshi',
      method: 'POST',
      headers: expectedHeaders,
      sendTime,
      body: '',
    };
    expect(Http.parseHttpRequestOptions(options1)).toEqual(expected1);

    const url2 = 'https://asdf.io:1234/yo.php?ref=baba';
    const options2 = { headers, method: 'POST' };
    const expected2 = {
      body: '',
      headers: {
        x: 'Y',
        z: 'A',
        host: 'asdf.io',
      },
      host: 'asdf.io',
      method: 'POST',
      path: '/yo.php',
      uri: 'asdf.io/yo.php',
      port: '1234',
      protocol: 'https:',
      sendTime: 895179612345,
    };

    expect(Http.parseHttpRequestOptions(options2, url2)).toEqual(expected2);
  });

  test('createEmitResponseHandler - add span simple flow', () => {
    const transactionId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
    const testData = {
      randomId: 'DummyRandomId',
      requestData: {
        a: 'request',
        sendTime: 1,
        host: 'your.mind.com',
        headers: { host: 'your.mind.com' },
        body: '',
      },
      responseData: {
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A' },
        body: 'SomeResponse',
      },
    };
    const handlerInputs = new HandlerInputesBuilder()
      .withAwsRequestId('DummyParentId')
      .withInvokedFunctionArn('arn:aws:l:region:335722316285:function:dummy-func')
      .build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    let responseEmitter = new EventEmitter();
    responseEmitter = Object.assign(responseEmitter, testData.responseData);

    MockDate.set(testData.responseData.receivedTime);

    Http.createEmitResponseHandler(
      transactionId,
      'DummyParentId2',
      testData.requestData,
      testData.randomId
    )(responseEmitter);

    responseEmitter.emit('data', testData.responseData.body);
    responseEmitter.emit('end');

    const expectedHttpSpan = new HttpSpanBuilder()
      .withSpanId(testData.randomId)
      .withParentId('DummyParentId2')
      .withReporterAwsRequestId('DummyParentId')
      .withInvokedArn('arn:aws:l:region:335722316285:function:dummy-func')
      .withEnded(testData.responseData.receivedTime)
      .withStarted(1)
      .withAccountId('335722316285')
      .withResponse(testData.responseData)
      .withRequest(testData.requestData)
      .withHost(testData.requestData.host)
      .build();
    const actual = SpansContainer.getSpans();
    expect(actual).toEqual([expectedHttpSpan]);
  });
  test('createEmitResponseHandler - add big span simple flow', () => {
    const transactionId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
    const testData = {
      randomId: 'DummyRandomId',
      requestData: {
        a: 'request',
        sendTime: 1,
        host: 'your.mind.com',
        headers: { host: 'your.mind.com' },
        body: '',
      },
      responseData: {
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A' },
        body: 'start' + 'a'.repeat(10000),
      },
    };
    const handlerInputs = new HandlerInputesBuilder()
      .withAwsRequestId('DummyParentId')
      .withInvokedFunctionArn('arn:aws:l:region:335722316285:function:dummy-func')
      .build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    let responseEmitter = new EventEmitter();
    responseEmitter = Object.assign(responseEmitter, testData.responseData);

    MockDate.set(testData.responseData.receivedTime);

    Http.createEmitResponseHandler(
      transactionId,
      'DummyParentId2',
      testData.requestData,
      testData.randomId
    )(responseEmitter);

    responseEmitter.emit('data', 'start');
    responseEmitter.emit('data', 'a'.repeat(10000));
    responseEmitter.emit('end');

    const expectedHttpSpan = new HttpSpanBuilder()
      .withSpanId(testData.randomId)
      .withParentId('DummyParentId2')
      .withReporterAwsRequestId('DummyParentId')
      .withInvokedArn('arn:aws:l:region:335722316285:function:dummy-func')
      .withEnded(testData.responseData.receivedTime)
      .withStarted(1)
      .withAccountId('335722316285')
      .withResponse({ ...testData.responseData, body: 'start' + 'a'.repeat(2043) })
      .withRequest(testData.requestData)
      .withHost(testData.requestData.host)
      .build();
    expect(SpansContainer.getSpans()).toEqual([expectedHttpSpan]);
  });
  test('createEmitResponseHandler - change request id from headers', () => {
    const testData = {
      randomId: 'DummyRandomId',
      requestData: {
        a: 'request',
        sendTime: 1,
        host: 'lambda.amazonaws.com',
        path: 'a/b/c/FuncName',
        headers: { host: 'lambda.amazonaws.com' },
        body: '',
      },
      responseData: {
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A', 'x-amzn-requestid': 'newSpanId' },
        body: 'SomeResponse',
      },
    };
    const transactionId = getCurrentTransactionId();
    const handlerInputs = new HandlerInputesBuilder()
      .withAwsRequestId('DummyParentId')
      .withInvokedFunctionArn('arn:aws:l:region:335722316285:function:dummy-func')
      .build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    const previousSpan = new HttpSpanBuilder()
      .withSpanId(testData.randomId)
      .withParentId('DummyParentId')
      .withReporterAwsRequestId('DummyParentId')
      .withInvokedArn('arn:aws:l:region:335722316285:function:dummy-func')
      .withEnded(testData.responseData.receivedTime)
      .withStarted(1)
      .withAccountId('335722316285')
      .withResponse(testData.responseData)
      .withRequest(testData.requestData)
      .withHost(testData.requestData.host)
      .build();

    SpansContainer.addSpan(previousSpan);

    let responseEmitter = new EventEmitter();
    responseEmitter = Object.assign(responseEmitter, testData.responseData);

    MockDate.set(testData.responseData.receivedTime);

    Http.createEmitResponseHandler(
      transactionId,
      'DummyParentId',
      testData.requestData,
      testData.randomId
    )(responseEmitter);

    responseEmitter.emit('data', testData.responseData.body);
    responseEmitter.emit('end');

    const expectedHttpSpan = {
      ...previousSpan,
      id: 'newSpanId',
      info: {
        ...previousSpan.info,
        invocationType: undefined,
        resourceName: 'FuncName',
      },
      service: 'lambda',
    };
    expect(SpansContainer.getSpans()).toEqual([expectedHttpSpan]);
  });

  test('wrappedHttpResponseCallback -> fail on getHttpSpan', () => {
    const transactionId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
    const testData = {
      randomId: 'DummyRandomId',
      requestData: {
        a: 'request',
        sendTime: 1,
        host: 'your.mind.com',
        headers: { host: 'your.mind.com' },
        body: '',
      },
      responseData: {
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A' },
        body: 'SomeResponse',
      },
    };

    jest.spyOn(SpansContainer, 'addSpan').mockImplementationOnce(() => {
      throw Error();
    });

    const handlerInputs = new HandlerInputesBuilder()
      .withAwsRequestId('DummyParentId')
      .withInvokedFunctionArn('arn:aws:l:region:335722316285:function:dummy-func')
      .build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    let responseEmitter = new EventEmitter();
    responseEmitter = Object.assign(responseEmitter, testData.responseData);

    MockDate.set(testData.responseData.receivedTime);

    Http.createEmitResponseHandler(
      transactionId,
      'DummyParentId',
      testData.requestData,
      testData.randomId
    )(responseEmitter);

    responseEmitter.emit('data', testData.responseData.body);
    responseEmitter.emit('end');

    expect(SpansContainer.getSpans()).toEqual([]);
  });

  test('wrappedHttpResponseCallback no exception in response.on(end)', () => {
    const clonedResponse1 = new EventEmitter();
    clonedResponse1.on = (name, callback) => callback();

    //This should raise exception
    const requestData = { host: 'dynamodb.amazonaws.com' };

    Http.createEmitResponseHandler(requestData)({});
    // No exception.
  });

  test('wrappedHttpResponseCallback no exception', () => {
    // Calling without params raising Exception
    Http.createEmitResponseHandler()({});
    // Assert No exception.
  });

  test('httpRequestEndWrapper', () => {
    const body = 'abcdefg';
    const requestData = { body: '' };

    const data = body;
    const encoding = 'utf8';
    const callback = jest.fn();
    Http.httpRequestEndWrapper(requestData)([data, encoding, callback]);

    expect(requestData).toEqual({ body: body });
  });

  test('httpRequestArguments -> no arguments', () => {
    expect(() => Http.httpRequestArguments([])).toThrow(
      new Error('http/s.request(...) was called without any arguments.')
    );
  });

  test('httpRequestArguments -> http(stringUrl)', () => {
    const expected1 = {
      url: 'https://x.com',
      options: undefined,
      callback: undefined,
    };
    expect(Http.httpRequestArguments(['https://x.com'])).toEqual(expected1);
  });

  test('httpRequestArguments -> http(stringUrl, callback)', () => {
    const callback = () => {};

    const expected2 = {
      url: 'https://x.com',
      options: undefined,
      callback,
    };
    expect(Http.httpRequestArguments(['https://x.com', callback])).toEqual(expected2);
  });

  test('httpRequestArguments -> http(stringUrl, options, callback)', () => {
    const callback = () => {};
    const options = { a: 'b' };
    const expected3 = {
      url: 'https://x.com',
      options,
      callback,
    };
    expect(Http.httpRequestArguments(['https://x.com', options, callback])).toEqual(expected3);
  });

  test('httpRequestArguments -> http(options, callback)', () => {
    const callback = () => {};
    const options = { a: 'b' };
    const expected4 = {
      url: undefined,
      options,
      callback,
    };
    expect(Http.httpRequestArguments([options, callback])).toEqual(expected4);
  });

  test('httpRequestArguments -> http(objectUrl)', () => {
    const url = new URL('https://x.com');
    const expected1 = {
      url,
      options: undefined,
      callback: undefined,
    };
    expect(Http.httpRequestArguments([url])).toEqual(expected1);
  });

  test('httpRequestArguments -> http(objectUrl, options)', () => {
    const url = new URL('https://x.com');
    const options = { a: 'b' };
    const expected1 = {
      url,
      options,
      callback: undefined,
    };
    expect(Http.httpRequestArguments([url, options])).toEqual(expected1);
  });

  test('httpRequestArguments -> http(objectUrl, callback)', () => {
    const url = new URL('https://x.com');
    const callback = () => {};
    const expected1 = {
      url,
      options: undefined,
      callback,
    };
    expect(Http.httpRequestArguments([url, callback])).toEqual(expected1);
  });

  test('wrapHttpLib - simple flow', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    Http.wrapHttpLib(HttpsMocker);

    const req = HttpsMocker.request(requestData, () => {});
    HttpsScenarioBuilder.appendNextResponse(req, responseData.body);

    const spans = SpansContainer.getSpans();

    const expectedSpan = new HttpSpanBuilder()
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withSpanId(spans[0].id)
      .withHttpInfo({
        host: HttpSpanBuilder.DEFAULT_HOST,
        request: requestData,
        response: responseData,
      })
      .withRequestTimesFromSpan(spans[0])
      .build();

    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - Timer time is passed', () => {
    process.env.LUMIGO_TRACER_TIMEOUT = '0';

    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    Http.wrapHttpLib(HttpsMocker);

    const req = HttpsMocker.request(requestData, () => {});
    HttpsScenarioBuilder.appendNextResponse(req, responseData.body);

    const spans = SpansContainer.getSpans();

    expect(spans).toEqual([]);
  });

  test('wrapHttpLib - no callback provided', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    Http.wrapHttpLib(HttpsMocker);

    const req = HttpsMocker.request(requestData);
    HttpsScenarioBuilder.appendNextResponse(req, responseData.body);

    const spans = SpansContainer.getSpans();

    const expectedSpan = new HttpSpanBuilder()
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withSpanId(spans[0].id)
      .withHttpInfo({
        host: HttpSpanBuilder.DEFAULT_HOST,
        request: requestData,
        response: responseData,
      })
      .withRequestTimesFromSpan(spans[0])
      .build();

    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - adding token after globals cleared', () => {
    TracerGlobals.setTracerInputs({ token: 'TOKEN' });
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    Http.wrapHttpLib(HttpsMocker);

    TracerGlobals.setTracerInputs({ token: 'TOKEN' });
    clearGlobals();

    const req = HttpsMocker.request({});
    HttpsScenarioBuilder.appendNextResponse(req, {});

    const spans = SpansContainer.getSpans();

    expect(spans.length).toEqual(1);
    expect(spans[0].token).toEqual('TOKEN');
  });

  test('wrapHttpLib - black listed url', () => {
    const edgeHost = 'http://a.com';
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    TracerGlobals.setTracerInputs({ ...TracerGlobals.getTracerInputs(), edgeHost });

    const requestData = { host: edgeHost };
    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    Http.wrapHttpLib(HttpsMocker);

    const req = HttpsMocker.request(requestData);
    HttpsScenarioBuilder.appendNextResponse(req, responseData.body);

    const spans = SpansContainer.getSpans();

    expect(spans).toEqual([]);
  });

  test('wrapHttpLib - added span before request finish', () => {
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);

    HttpsScenarioBuilder.dontFinishNextRequest();

    Http.wrapHttpLib(HttpsMocker);
    HttpsMocker.request(requestData, () => {});

    const spans = SpansContainer.getSpans();

    const expectedSpan = new HttpSpanBuilder()
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withSpanId(spans[0].id)
      .withHttpInfo({
        host: HttpSpanBuilder.DEFAULT_HOST,
        request: requestData,
      })
      .withNoResponse()
      .withRequestTimesFromSpan(spans[0])
      .build();

    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - added span before request finish for aws service', () => {
    const host = 'random.amazonaws.com';

    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    let requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    requestData.host = host;
    requestData.headers.host = host;
    requestData.uri = `${host}/`;

    HttpsScenarioBuilder.dontFinishNextRequest();

    Http.wrapHttpLib(HttpsMocker);
    HttpsMocker.request(requestData, () => {});

    const spans = SpansContainer.getSpans();

    const expectedSpan = new HttpSpanBuilder()
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withSpanId(spans[0].id)
      .withHttpInfo({
        request: requestData,
      })
      .withHost('random.amazonaws.com')
      .withNoResponse()
      .withRequestTimesFromSpan(spans[0])
      .build();

    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - wrapping twice not effecting', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    Http.wrapHttpLib(HttpsMocker);
    Http.wrapHttpLib(HttpsMocker);

    const reqContext = HttpsMocker.request(requestData, () => {});
    HttpsScenarioBuilder.appendNextResponse(reqContext, responseData.body);

    const spans = SpansContainer.getSpans();

    const expectedSpan = new HttpSpanBuilder()
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withSpanId(spans[0].id)
      .withHost(HttpSpanBuilder.DEFAULT_HOST)
      .withHttpInfo({
        host: HttpSpanBuilder.DEFAULT_HOST,
        request: requestData,
        response: responseData,
      })
      .withRequestTimesFromSpan(spans[0])
      .build();

    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - invalid alias dont save spans', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const cleanRequestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    let a = {};
    let requestData = { ...cleanRequestData };
    a.requestData = requestData;
    requestData.a = a;

    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    TracerGlobals.setHandlerInputs({
      event: {},
      context: {
        invokedFunctionArn: 'arn:aws:lambda:region:account:function:name:alias',
      },
    });
    process.env['LUMIGO_VALID_ALIASES'] = '["wrong"]';

    Http.wrapHttpLib(HttpsMocker);

    const requestContext = HttpsMocker.request(requestData, () => {});
    HttpsScenarioBuilder.appendNextResponse(requestContext, responseData.body);

    const spans = SpansContainer.getSpans();

    expect(spans).toEqual([]);
  });

  test('wrapHttpLib - circular object wrapper cutting object', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const cleanRequestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    let a = {};
    let requestData = { ...cleanRequestData };
    a.requestData = requestData;
    requestData.a = a;

    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    Http.wrapHttpLib(HttpsMocker);

    const requstContext = HttpsMocker.request(requestData, () => {});
    HttpsScenarioBuilder.appendNextResponse(requstContext, responseData.body);

    const spans = SpansContainer.getSpans();

    const expectedSpan = new HttpSpanBuilder()
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withSpanId(spans[0].id)
      .withHttpInfo({
        host: HttpSpanBuilder.DEFAULT_HOST,
        request: cleanRequestData,
        response: responseData,
      })
      .withRequestTimesFromSpan(spans[0])
      .build();

    expect(spans).toEqual([expectedSpan]);
  });

  test('addStepFunctionEvent', () => {
    Http.addStepFunctionEvent('123');

    const spans = SpansContainer.getSpans();

    expect(spans.length).toEqual(1);
    expect(spans[0].info.resourceName).toEqual('StepFunction');
    expect(spans[0].info.httpInfo.host).toEqual('StepFunction');
    expect(spans[0].info.messageId).toEqual('123');
    expect(spans[0].started).toBeDefined();
  });

  test('wrapHttpLib - shimmer all wraps failed', () => {
    utils.setWarm();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);

    spies.shimmer.mockImplementation((obj, funcName) => {
      if (['end', 'emit', 'on', 'write'].includes(funcName)) {
        throw Error(funcName);
      }
    });
    Http.wrapHttpLib(HttpsMocker.request);

    HttpsMocker.request(requestData, () => {});

    expect(HttpsRequestsForTesting.getStartedRequests()).toEqual(1);
  });
});
