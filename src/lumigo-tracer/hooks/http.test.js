import EventEmitter from 'events';
import MockDate from 'mockdate';
import * as shimmer from 'shimmer';
import {
  HttpsMocker,
  HttpsRequestsForTesting,
  HttpsScenarioBuilder,
} from '../../testUtils/httpsMocker';
import { HttpSpanBuilder } from '../../testUtils/httpSpanBuilder';

import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import {
  clearGlobals,
  MAX_TRACER_ADDED_DURATION_ALLOWED,
  SpansContainer,
  TracerGlobals,
} from '../globals';
import { getCurrentTransactionId } from '../spans/awsSpan';
import * as utils from '../utils';
import { TRACESTATE_HEADER_NAME } from '../utils/w3cUtils';
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

  [
    ['someResponse', 'someResponse'], // non  buffer
    [Buffer.from('1f8b0800000000000000', 'hex'), '1f8b0800000000000000'], // gzip header
    [Buffer.from('f09f9592', 'hex'), '🕒'], // utf8
  ].forEach(([responseBody, expected]) =>
    test('createEmitResponseHandler - add span simple flow', () => {
      const transactionId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
      const testData = {
        randomId: 'DummyRandomId',
        requestData: {
          truncated: false,
          a: 'request',
          sendTime: 1,
          host: 'your.mind.com',
          headers: { host: 'your.mind.com' },
          body: '',
        },
        responseData: {
          statusCode: 200,
          truncated: false,
          receivedTime: 895179612345,
          headers: { X: 'Y', z: 'A' },
          body: responseBody,
        },
      };
      const handlerInputs = new HandlerInputsBuilder()
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
        .withResponse({
          statusCode: testData.responseData.statusCode,
          truncated: false,
          receivedTime: testData.responseData.receivedTime,
          headers: testData.responseData.headers,
          body: expected,
        })
        .withRequest(testData.requestData)
        .withHost(testData.requestData.host)
        .build();
      const actual = SpansContainer.getSpans();
      expect(actual).toEqual([expectedHttpSpan]);
    })
  );

  test('createEmitResponseHandler - add big span simple flow', () => {
    const transactionId = HttpSpanBuilder.DEFAULT_TRANSACTION_ID;
    const testData = {
      randomId: 'DummyRandomId',
      requestData: {
        a: 'request',
        sendTime: 1,
        truncated: false,
        host: 'your.mind.com',
        headers: { host: 'your.mind.com' },
        body: '',
      },
      responseData: {
        truncated: true,
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A' },
        body: 'start' + 'a'.repeat(10000),
      },
    };
    const handlerInputs = new HandlerInputsBuilder()
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
        truncated: false,
        a: 'request',
        sendTime: 1,
        host: 'lambda.amazonaws.com',
        path: 'a/b/c/FuncName',
        headers: { host: 'lambda.amazonaws.com' },
        body: '',
      },
      responseData: {
        truncated: false,
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A', 'x-amzn-requestid': 'newSpanId' },
        body: 'SomeResponse',
      },
    };
    const transactionId = getCurrentTransactionId();
    const handlerInputs = new HandlerInputsBuilder()
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
        truncated: false,
        statusCode: 200,
        receivedTime: 895179612345,
        headers: { X: 'Y', z: 'A' },
        body: 'SomeResponse',
      },
    };

    jest.spyOn(SpansContainer, 'addSpan').mockImplementationOnce(() => {
      throw Error();
    });

    const handlerInputs = new HandlerInputsBuilder()
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

  test('addOptionsToHttpRequestArguments', () => {
    // This test goes over all the options of inputs to: https://nodejs.org/api/http.html#httpgeturl-options-callback
    const url = new URL('http://saart.info');
    const callback = () => {};
    const newOptions = { a: 'b' };

    // http.get(url)
    const originalArgs0 = [url];
    const expected0 = [url, newOptions];
    Http.addOptionsToHttpRequestArguments(originalArgs0, newOptions);
    expect(originalArgs0).toEqual(expected0);

    // http.get(url, callback)
    const originalArgs1 = [url, callback];
    const expected1 = [url, newOptions, callback];
    Http.addOptionsToHttpRequestArguments(originalArgs1, newOptions);
    expect(originalArgs1).toEqual(expected1);

    // http.get(url, options)
    const originalArgs2 = [url, { c: 'd' }];
    const expected2 = [url, newOptions];
    Http.addOptionsToHttpRequestArguments(originalArgs2, newOptions);
    expect(originalArgs2).toEqual(expected2);

    // http.get(url, options, callback)
    const originalArgs3 = [url, { c: 'd' }, callback];
    const expected3 = [url, newOptions, callback];
    Http.addOptionsToHttpRequestArguments(originalArgs3, newOptions);
    expect(originalArgs3).toEqual(expected3);

    // http.get(options)
    const originalArgs4 = [{ c: 'd' }];
    const expected4 = [newOptions];
    Http.addOptionsToHttpRequestArguments(originalArgs4, newOptions);
    expect(originalArgs4).toEqual(expected4);
  });

  test('wrapHttpLib - missing _X_AMZN_TRACE_ID', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    process.env._X_AMZN_TRACE_ID = undefined;
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      truncated: false,
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
      .withTransactionId('36643236653363382d363061')
      .withSpanId(spans[0].id)
      .withInfoTraceId('6643236', '36643236653363382d363061', '1', '36643236653363382d363061')
      .withHttpInfo({
        host: HttpSpanBuilder.DEFAULT_HOST,
        request: requestData,
        response: responseData,
      })
      .withRequestTimesFromSpan(spans[0])
      .build();

    spans.forEach((span) => delete span.info.messageId);
    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - simple flow', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      truncated: false,
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

    spans.forEach((span) => delete span.info.messageId);
    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - add W3C headers', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      truncated: false,
      statusCode: 200,
      body: 'OK',
    };

    Http.wrapHttpLib(HttpsMocker);

    const req = HttpsMocker.request(requestData, () => {});
    HttpsScenarioBuilder.appendNextResponse(req, responseData.body);

    const span = SpansContainer.getSpans()[0];

    expect(span.info.httpInfo.request.headers[TRACESTATE_HEADER_NAME]).toBeDefined();
  });

  test('wrapHttpLib - adding TRACESTATE_HEADER_NAME - headers exists', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    Http.wrapHttpLib(HttpsMocker);

    const req = HttpsMocker.request({ headers: { a: 'b' } }, () => {});
    req.write('headers exists');

    const requests = HttpsRequestsForTesting.getRequests();
    expect(
      requests.some(
        (request) =>
          request.options.headers[TRACESTATE_HEADER_NAME] &&
          request.options.headers.a === 'b' &&
          request.body === 'headers exists'
      )
    ).toBeTruthy();
  });

  test('wrapHttpLib - adding TRACESTATE_HEADER_NAME - headers doesnt exists', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    Http.wrapHttpLib(HttpsMocker);

    const req = HttpsMocker.request({}, () => {});
    req.write('headers doesnt exists');

    const requests = HttpsRequestsForTesting.getRequests();
    expect(
      requests.some(
        (request) =>
          request.options.headers[TRACESTATE_HEADER_NAME] &&
          request.body === 'headers doesnt exists'
      )
    ).toBeTruthy();
  });

  test('wrapHttpLib - Timer time is passed', () => {
    process.env.LUMIGO_TRACER_TIMEOUT = '0';

    const handlerInputs = new HandlerInputsBuilder().build();
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
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      truncated: false,
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

    spans.forEach((span) => delete span.info.messageId);
    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - adding token after globals cleared', () => {
    TracerGlobals.setTracerInputs({ token: 'TOKEN' });
    const handlerInputs = new HandlerInputsBuilder().build();
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
    const handlerInputs = new HandlerInputsBuilder().build();
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
    const handlerInputs = new HandlerInputsBuilder().build();
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

    spans.forEach((span) => delete span.info.messageId);
    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - added span before request finish for aws service', () => {
    const host = 'random.amazonaws.com';

    const handlerInputs = new HandlerInputsBuilder().build();
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

    spans.forEach((span) => delete span.info.messageId);
    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - wrapping twice not effecting', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      truncated: false,
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

    spans.forEach((span) => delete span.info.messageId);
    expect(spans).toEqual([expectedSpan]);
  });

  test('wrapHttpLib - invalid alias dont save spans', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
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
        getRemainingTimeInMillis: () => MAX_TRACER_ADDED_DURATION_ALLOWED,
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
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const cleanRequestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    let a = {};
    let requestData = { ...cleanRequestData };
    a.requestData = requestData;
    requestData.a = a;

    const responseData = {
      truncated: false,
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

    spans.forEach((span) => delete span.info.messageId);
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
    const handlerInputs = new HandlerInputsBuilder().build();
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
