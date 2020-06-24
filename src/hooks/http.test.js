import { lowerCaseObjectKeys } from '../utils';
import EventEmitter from 'events';
import defaultHttp from './http';
import MockDate from 'mockdate';
import shimmer from 'shimmer';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { HttpSpanBuilder } from '../../testUtils/httpSpanBuilder';
import {
  HttpsMocker,
  HttpsScenarioBuilder,
  HttpsRequestsForTesting,
} from '../../testUtils/httpsMocker';

import * as httpHook from './http';
import * as utils from '../utils';
import { SpansContainer, TracerGlobals } from '../globals';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';

jest.mock('../reporter');

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';
  process.env['_X_AMZN_TRACE_ID'] =
    'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';

  const spies = {};
  spies.getEdgeHost = jest.spyOn(utils, 'getEdgeHost');
  spies.randomBytes = jest.spyOn(crypto, 'randomBytes');
  spies.getRandomId = jest.spyOn(utils, 'getRandomId');
  spies.shimmer = jest.spyOn(shimmer, 'wrap');

  beforeEach(() => {
    spies.shimmer.mockClear();
    shimmer.unwrap(HttpsMocker, 'request');
  });

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    expect(httpHook.isBlacklisted(host)).toBe(false);
    expect(httpHook.isBlacklisted(edgeHost)).toBe(true);
  });

  test('httpRequestEmitWrapper -> outputData flow', () => {
    const requestData = {
      body: '',
    };
    const randomRequstId = 'REQ';
    const wrapper = httpHook.httpRequestEmitWrapper(requestData, randomRequstId);
    const emitEventName = 'socket';
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        outputData: [{ data: 'HTTP BODY1\nHTTP BODY2' }],
      },
    };

    wrapper(emitEventName, emitArg);

    expect(requestData).toEqual({
      body: 'HTTP BODY2',
    });
  });

  test('httpRequestEmitWrapper -> output flow', () => {
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
    const wrapper = httpHook.httpRequestEmitWrapper(requestData);
    wrapper(emitEventName, emitArg);

    expect(requestData).toEqual({
      body: 'HTTP BODY2',
    });
  });

  test('httpRequestEmitWrapper -> not crashed on bad data', () => {
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

    const wrapper = httpHook.httpRequestEmitWrapper(requestData);
    wrapper(emitEventName, emitArg);

    expect(requestData).toEqual({ body: '' });
  });

  test('httpRequestWriteWrapper -> simple flow -> write(str)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';

    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    wrapper(firstArg);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteWrapper -> simple flow -> write(Buffer)', () => {
    const requestData = {
      body: '',
    };
    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    const firstArg = Buffer.from('BODY');

    wrapper(firstArg);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteWrapper -> simple flow -> write(Buffer, encoding)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';
    const secArg = 'base64';

    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    wrapper(firstArg, secArg);

    expect(requestData).toEqual({ body: 'Qk9EWQ==' });
  });

  test('httpRequestWriteWrapper -> simple flow -> write(Buffer, encoding, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = Buffer.from('BODY');
    const secArg = 'utf8';
    const thirdArg = () => {};

    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    wrapper(firstArg, secArg, thirdArg);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteWrapper -> simple flow -> write(Buffer, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = Buffer.from('BODY');
    const secArg = () => {};

    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    wrapper(firstArg, secArg);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteWrapper -> simple flow -> write(str, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';
    const secArg = () => {};

    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    wrapper(firstArg, secArg);

    expect(requestData).toEqual({ body: 'BODY' });
  });

  test('httpRequestWriteWrapper -> not override body', () => {
    const requestData = {
      body: 'BODY1',
    };

    const firstArg = Buffer.from('BODY2');

    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    wrapper(firstArg);

    expect(requestData).toEqual({ body: 'BODY1' });
  });

  test('httpRequestWriteWrapper -> not crashed on bad data', () => {
    const requestData = {
      body: '',
    };

    const firstArg = {};
    const secArg = {};

    const wrapper = httpHook.httpRequestWriteWrapper(requestData);
    wrapper(firstArg, secArg);

    expect(requestData).toEqual({ body: '' });
  });

  test('getHostFromOptionsOrUrl', () => {
    const options1 = { host: 'asdf1.com' };
    const options2 = { hostname: 'asdf2.com' };
    const options3 = { uri: { hostname: 'asdf3.com' } };
    const options4 = {};
    expect(httpHook.getHostFromOptionsOrUrl(options1)).toEqual('asdf1.com');
    expect(httpHook.getHostFromOptionsOrUrl(options2)).toEqual('asdf2.com');
    expect(httpHook.getHostFromOptionsOrUrl(options3)).toEqual('asdf3.com');
    expect(httpHook.getHostFromOptionsOrUrl(options4)).toEqual('localhost');

    const url1 = 'https://asdf.io:1234/yo?ref=baba';
    expect(httpHook.getHostFromOptionsOrUrl({}, url1)).toEqual('asdf.io');
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
    expect(httpHook.parseHttpRequestOptions(options1)).toEqual(expected1);

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

    expect(httpHook.parseHttpRequestOptions(options2, url2)).toEqual(expected2);
  });

  test('createEmitResponseHandler - add span simple flow', () => {
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

    httpHook.createEmitResponseHandler(testData.requestData, testData.randomId)(responseEmitter);

    responseEmitter.emit('data', testData.responseData.body);
    responseEmitter.emit('end');

    const expectedHttpSpan = new HttpSpanBuilder()
      .withSpanId(testData.randomId)
      .withParentId('DummyParentId')
      .withInvokedArn('arn:aws:l:region:335722316285:function:dummy-func')
      .withEnded(testData.responseData.receivedTime)
      .withStarted(1)
      .withAccountId('335722316285')
      .withResponse(testData.responseData)
      .withRequest(testData.requestData)
      .withHost(testData.requestData.host)
      .build();
    expect(SpansContainer.getSpans()).toEqual([expectedHttpSpan]);
  });

  test('wrappedHttpResponseCallback -> fail on getHttpSpan', () => {
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

    httpHook.createEmitResponseHandler(testData.requestData, testData.randomId)(responseEmitter);

    responseEmitter.emit('data', testData.responseData.body);
    responseEmitter.emit('end');

    expect(SpansContainer.getSpans()).toEqual([]);
  });

  test('wrappedHttpResponseCallback no exception in response.on(end)', () => {
    const clonedResponse1 = new EventEmitter();
    clonedResponse1.on = (name, callback) => callback();

    //This should raise exception
    const requestData = { host: 'dynamodb.amazonaws.com' };

    httpHook.createEmitResponseHandler(requestData)({});
    // No exception.
  });

  test('wrappedHttpResponseCallback no exception', () => {
    // Calling without params raising Exception
    httpHook.createEmitResponseHandler()({});
    // Assert No exception.
  });

  test('httpRequestEndWrapper', () => {
    const body = 'abcdefg';
    const requestData = { body: '' };

    const data = body;
    const encoding = 'utf8';
    const callback = jest.fn();
    httpHook.httpRequestEndWrapper(requestData)(data, encoding, callback);

    expect(requestData).toEqual({ body });
  });

  test('httpRequestArguments -> no arguments', () => {
    expect(() => httpHook.httpRequestArguments([])).toThrow(
      new Error('http/s.request(...) was called without any arguments.')
    );
  });

  test('httpRequestArguments -> http(stringUrl)', () => {
    const expected1 = {
      url: 'https://x.com',
      options: undefined,
      callback: undefined,
    };
    expect(httpHook.httpRequestArguments(['https://x.com'])).toEqual(expected1);
  });

  test('httpRequestArguments -> http(stringUrl, callback)', () => {
    const callback = () => {};

    const expected2 = {
      url: 'https://x.com',
      options: undefined,
      callback,
    };
    expect(httpHook.httpRequestArguments(['https://x.com', callback])).toEqual(expected2);
  });

  test('httpRequestArguments -> http(stringUrl, options, callback)', () => {
    const callback = () => {};
    const options = { a: 'b' };
    const expected3 = {
      url: 'https://x.com',
      options,
      callback,
    };
    expect(httpHook.httpRequestArguments(['https://x.com', options, callback])).toEqual(expected3);
  });

  test('httpRequestArguments -> http(options, callback)', () => {
    const callback = () => {};
    const options = { a: 'b' };
    const expected4 = {
      url: undefined,
      options,
      callback,
    };
    expect(httpHook.httpRequestArguments([options, callback])).toEqual(expected4);
  });

  test('httpRequestArguments -> http(objectUrl)', () => {
    const url = new URL('https://x.com');
    const expected1 = {
      url,
      options: undefined,
      callback: undefined,
    };
    expect(httpHook.httpRequestArguments([url])).toEqual(expected1);
  });

  test('httpRequestArguments -> http(objectUrl, options)', () => {
    const url = new URL('https://x.com');
    const options = { a: 'b' };
    const expected1 = {
      url,
      options,
      callback: undefined,
    };
    expect(httpHook.httpRequestArguments([url, options])).toEqual(expected1);
  });

  test('httpRequestArguments -> http(objectUrl, callback)', () => {
    const url = new URL('https://x.com');
    const callback = () => {};
    const expected1 = {
      url,
      options: undefined,
      callback,
    };
    expect(httpHook.httpRequestArguments([url, callback])).toEqual(expected1);
  });

  test('httpRequestWrapper', () => {
    const originalRequestFn = jest.fn();
    const edgeHost = 'edge-asdf.com';
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    const callback1 = jest.fn();

    // Blacklisted.
    const options1 = { host: edgeHost };
    httpHook.httpRequestWrapper(originalRequestFn)(options1, callback1);
    expect(originalRequestFn).toHaveBeenCalledWith(options1, callback1);

    originalRequestFn.mockClear();

    // Already traced.
    const options3 = { host: 'bla.com' };
    const callback3 = jest.fn();
    callback3.__lumigoSentinel = true;
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    httpHook.httpRequestWrapper(originalRequestFn)(options3, callback3);
    expect(originalRequestFn).toHaveBeenCalledWith(options3, callback3);

    originalRequestFn.mockClear();

    // Error within Lumigo's code.
    const options5 = { host: 'bla.com' };
    const callback5 = jest.fn();
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    originalRequestFn.mockImplementationOnce(() => {
      throw new Error();
    });

    httpHook.httpRequestWrapper(originalRequestFn)(options5, callback5);
    expect(originalRequestFn).toHaveBeenCalledTimes(2);
    expect(originalRequestFn).toHaveBeenCalledWith(options5, expect.any(Function));
    originalRequestFn.mockClear();

    spies.randomBytes.mockReturnValueOnce(Buffer.from('aa'));
    // Regular case
    const options2 = {
      host: 'baba.amazonaws.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers: { X: 'Y' },
    };

    const callback2 = jest.fn();

    const clientRequest = { a: 'b' };
    originalRequestFn.mockReturnValueOnce(clientRequest);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);

    const expectedHeaders2 = {
      X: 'Y',
      ['X-Amzn-Trace-Id']:
        'Root=1-00006161-64a1b06067c2100c52e51ef4;Parent=28effe37598bb622;Sampled=0',
    };
    const expectedOptions2 = Object.assign({}, options2, {
      headers: expectedHeaders2,
    });
    expect(httpHook.httpRequestWrapper(originalRequestFn)(options2, callback2)).toEqual(
      clientRequest
    );

    expect(originalRequestFn).toHaveBeenCalledWith(expectedOptions2, expect.any(Function));

    originalRequestFn.mockClear();
    // No callback provided case
    const options4 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers: { X: 'Y' },
    };

    const clientRequest4 = { a: 'b' };
    originalRequestFn.mockReturnValueOnce(clientRequest4);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    expect(httpHook.httpRequestWrapper(originalRequestFn)(options4)).toEqual(clientRequest4);

    expect(originalRequestFn).toHaveBeenCalledWith(options4);

    //Circular object
    const a6 = {};
    const b6 = { a6 };
    a6.b6 = b6;
    const options6 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers: { X: 'Y' },
      a6,
    };

    const clientRequest6 = { a: 'b' };
    originalRequestFn.mockReturnValueOnce(clientRequest6);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    expect(httpHook.httpRequestWrapper(originalRequestFn)(options6)).toEqual(clientRequest6);

    expect(originalRequestFn).toHaveBeenCalledWith(options4);
  });

  test('httpRequestWrapper - simple flow', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    shimmer.wrap(HttpsMocker, 'request', httpHook.httpRequestWrapper);
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

  test('httpRequestWrapper - added span before request finish', () => {
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);

    HttpsScenarioBuilder.dontFinishNextRequest();

    shimmer.wrap(HttpsMocker, 'request', httpHook.httpRequestWrapper);
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

  test('httpRequestWrapper - added span before request finish for aws service', () => {
    const host = 'random.amazonaws.com';

    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    let requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    requestData.host = host;
    requestData.headers.host = host;
    requestData.uri = `${host}/`;

    HttpsScenarioBuilder.dontFinishNextRequest();

    shimmer.wrap(HttpsMocker, 'request', httpHook.httpRequestWrapper);
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

  test('httpRequestWrapper - wrapping twice not effecting', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);
    const responseData = {
      statusCode: 200,
      body: 'OK',
    };

    shimmer.wrap(HttpsMocker, 'request', httpHook.httpRequestWrapper);
    shimmer.wrap(HttpsMocker, 'request', httpHook.httpRequestWrapper);

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

  test('httpRequestWrapper - invalid alias dont save spans', () => {
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

    const wrappedRequest = httpHook.httpRequestWrapper(HttpsMocker.request);

    const requestContext = wrappedRequest(requestData, () => {});
    HttpsScenarioBuilder.appendNextResponse(requestContext, responseData.body);

    const spans = SpansContainer.getSpans();

    expect(spans).toEqual([]);
  });

  test('httpRequestWrapper - circular object wrapper cutting object', () => {
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

    const wrappedRequest = httpHook.httpRequestWrapper(HttpsMocker.request);

    const requstContext = wrappedRequest(requestData, () => {});
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

  test('httpGetWrapper', () => {
    const retVal = 'endCalled';
    const end = jest.fn(() => retVal);
    const req = { end };
    const request = jest.fn(() => req);
    const httpModule = { request };
    const fn = httpHook.httpGetWrapper(httpModule)();

    const args = ['x', 'y', 'z'];
    expect(fn(args)).toEqual(req);
    expect(httpModule.request).toHaveBeenCalledWith(args);
    expect(end).toHaveBeenCalled();
  });

  test('export default', () => {
    defaultHttp();
    expect(spies.shimmer).toHaveBeenCalledWith(http, 'request', httpHook.httpRequestWrapper);
    expect(spies.shimmer).toHaveBeenCalledWith(https, 'request', httpHook.httpRequestWrapper);
    expect(spies.shimmer).toHaveBeenCalledWith(https, 'get', expect.any(Function));
    expect(spies.shimmer).toHaveBeenCalledWith(https, 'get', expect.any(Function));
  });

  test('httpRequestWrapper no exception', () => {
    httpHook.httpRequestWrapper(() => {})(/* No argument */);
    // No exception.
  });

  test('addStepFunctionEvent', () => {
    httpHook.addStepFunctionEvent('123');

    const spans = SpansContainer.getSpans();

    expect(spans.length).toEqual(1);
    expect(spans[0].info.resourceName).toEqual('StepFunction');
    expect(spans[0].info.httpInfo.host).toEqual('StepFunction');
    expect(spans[0].info.messageId).toEqual('123');
  });

  test('httpRequestWrapper - shimmer all wraps failed', () => {
    utils.setWarm();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    const requestData = HttpSpanBuilder.getDefaultData(HttpSpanBuilder.DEFAULT_REQUEST_DATA);

    spies.shimmer.mockImplementation((obj, funcName) => {
      if (['end', 'emit', 'on', 'write'].includes(funcName)) {
        throw Error(funcName);
      }
    });
    const wrappedRequest = httpHook.httpRequestWrapper(HttpsMocker.request);

    wrappedRequest(requestData, () => {});

    expect(HttpsRequestsForTesting.getStartedRequests()).toEqual(1);
  });
});
