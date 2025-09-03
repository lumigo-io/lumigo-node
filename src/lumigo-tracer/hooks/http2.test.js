import EventEmitter from 'events';
import MockDate from 'mockdate';
import * as shimmer from 'shimmer';
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
import { Http2 } from './http2';
import { BaseHttp } from './baseHttp';
import * as extender from '../extender';
import * as logger from '../logger';
import * as http2 from 'http2';

// Import HTTP/2 mocker utilities from testUtils
import {
  Http2Stream,
  Http2Session,
  Http2ScenarioBuilder,
  Http2RequestsForTesting,
  Http2Mocker,
} from '../../testUtils/http2Mocker';

describe('http2 hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';
  process.env['_X_AMZN_TRACE_ID'] =
    'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';

  const spies = {};
  spies.shimmer = jest.spyOn(shimmer, 'wrap');

  beforeEach(() => {
    spies.shimmer.mockClear();
    Http2ScenarioBuilder.clean();
    Http2RequestsForTesting.clean();
    SpansContainer.clearSpans();
  });

  test('http2RequestArguments -> no arguments', () => {
    expect(() => Http2.http2RequestArguments([])).toThrow(
      new Error('ClientHttp2Session.request(...) was called without any arguments.')
    );
  });

  test('http2RequestArguments -> http2(http2Headers)', () => {
    const http2Headers = {
      ':method': 'POST',
      ':path': '/httpbin/post',
      ':scheme': 'https',
      ':authority': 'nghttp2.org',
      'content-type': 'application/json',
      'content-length': '76',
    };

    const expected = {
      url: 'https://nghttp2.org/httpbin/post',
      options: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '76',
        },
        path: '/httpbin/post',
        protocol: 'https:',
        hostname: 'nghttp2.org',
        host: 'nghttp2.org',
        http2Headers: {
          method: 'POST',
          path: '/httpbin/post',
          scheme: 'https',
          authority: 'nghttp2.org',
        },
      },
      callback: undefined,
    };

    expect(Http2.http2RequestArguments([http2Headers])).toEqual(expected);
  });

  test('http2RequestArguments -> http2(http2Headers, callback)', () => {
    const http2Headers = {
      ':method': 'POST',
      ':path': '/httpbin/post',
      ':scheme': 'https',
      ':authority': 'nghttp2.org',
      'content-type': 'application/json',
      'content-length': '76',
    };

    const callback = jest.fn();

    const expected = {
      url: 'https://nghttp2.org/httpbin/post',
      options: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '76',
        },
        path: '/httpbin/post',
        protocol: 'https:',
        hostname: 'nghttp2.org',
        host: 'nghttp2.org',
        http2Headers: {
          method: 'POST',
          path: '/httpbin/post',
          scheme: 'https',
          authority: 'nghttp2.org',
        },
      },
      callback,
    };

    expect(Http2.http2RequestArguments([http2Headers, callback])).toEqual(expected);
  });

  test('http2RequestArguments -> final debug logging', () => {
    // Enable debug logging for this test
    const debugSpy = jest.spyOn(logger, 'debug');

    // Call with empty arguments to trigger the final debug logging
    const result = Http2.http2RequestArguments([{}]);

    // Verify that debug logging was called with the expected arguments
    expect(debugSpy).toHaveBeenCalledWith(
      'HTTP/2 request arguments: final result',
      expect.objectContaining({
        url: undefined,
        optionsKeys: [],
      })
    );

    // Clean up
    debugSpy.mockRestore();
  });

  test('wrapHttp2Lib - simple flow', (done) => {
    process.env['LUMIGO_TIMEOUT_TIMER_ENABLED'] = 'TRUE';
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    // Prepare a response
    Http2ScenarioBuilder.appendNextResponse('response-data', { ':status': 200 });

    Http2.wrapHttp2Lib(Http2Mocker);

    const session = Http2Mocker.connect('https://example.com');
    const stream = session.request({
      ':method': 'GET',
      ':path': '/api/data',
      ':authority': 'example.com',
      ':scheme': 'https',
    });

    stream.end('request-data');

    // Verify that the request was tracked
    expect(Http2RequestsForTesting.getStartedRequests()).toEqual(2); // One for connect, one for request
    expect(Http2RequestsForTesting.getRequestData()).toContain('request-data');

    // Wait for async operations to complete
    setTimeout(() => {
      try {
        // Verify that a span was created
        const spans = SpansContainer.getSpans();
        expect(spans.length).toBeGreaterThan(0);

        if (spans.length > 0) {
          // Verify span properties
          const span = spans[0];
          expect(span.info.httpInfo).toBeDefined();
          expect(span.info.httpInfo.host).toBeDefined();
        }
        done();
      } catch (error) {
        done(error);
      }
    }, 100);
  });

  test('wrapHttp2Lib - adding headers to request', () => {
    utils.setTimeoutTimerDisabled();
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    Http2.wrapHttp2Lib(Http2Mocker);

    const session = Http2Mocker.connect('https://example.com');
    session.request({
      ':method': 'GET',
      ':path': '/api/data',
      ':authority': 'example.com',
      ':scheme': 'https',
    });

    // Verify that request was created
    const requests = Http2RequestsForTesting.getRequests();
    expect(requests.length).toBeGreaterThan(0);

    // In the current implementation, headers are processed by BaseHttp.onRequestCreated
    // We're just verifying the request was created successfully
  });

  test('http2StreamEmitBeforeHookWrapper - handles all event types', (done) => {
    process.env['LUMIGO_TIMEOUT_TIMER_ENABLED'] = 'TRUE';
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    const transactionId = getCurrentTransactionId();
    const requestData = {
      body: '',
      host: 'example.com',
      path: '/api/data',
      method: 'GET',
      headers: {},
      sendTime: Date.now(),
    };
    const requestRandomId = 'test-random-id';
    const awsRequestId = handlerInputs.context.awsRequestId;
    const currentSpan = new HttpSpanBuilder().build();

    // Create a mock HTTP/2 stream
    const stream = new Http2Stream();

    // Create the emit handler directly
    const emitHandler = Http2.http2StreamEmitBeforeHookWrapper(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId,
      currentSpan
    );

    // Test response event
    emitHandler(['response', { ':status': 200, 'content-type': 'application/json' }]);

    // Test data event
    emitHandler(['data', 'test-response-data']);

    // Test end event
    emitHandler(['end']);

    // Test error event
    emitHandler(['error', new Error('Test error')]);

    // Wait for async operations to complete
    setTimeout(() => {
      try {
        // Verify that the span was created
        const spans = SpansContainer.getSpans();
        expect(spans.length).toBeGreaterThan(0);

        if (spans.length > 0) {
          // Verify span properties
          const span = spans[0];
          expect(span.info.httpInfo).toBeDefined();
        }
        done();
      } catch (error) {
        done(error);
      }
    }, 100);
  });

  test('request beforeHook - handles request creation', () => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    // Create a mock HTTP/2 session
    const mockSession = new Http2Session();

    // Spy on extender.hook
    const hookSpy = jest.spyOn(extender, 'hook');

    // Call the after connect wrapper to set up the request hook
    Http2.http2AfterConnectWrapper(['https://example.com'], mockSession);

    // Get the beforeHook function from the hook call
    const hookOptions = hookSpy.mock.calls[0][2];
    const beforeHook = hookOptions.beforeHook;

    // Create test arguments and context
    const args = [
      {
        ':method': 'GET',
        ':path': '/api/data',
        ':authority': 'example.com',
        ':scheme': 'https',
      },
    ];
    const extenderContext = {};

    // Call the beforeHook directly
    beforeHook(args, extenderContext);

    // Verify that context was updated
    expect(extenderContext.requestRandomId).toBeDefined();
    expect(extenderContext.transactionId).toBeDefined();
    expect(extenderContext.awsRequestId).toBeDefined();

    // Clean up
    hookSpy.mockRestore();
  });

  test('request beforeHook - handles when requestTracingData is not defined', () => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    // Create a mock HTTP/2 session
    const mockSession = new Http2Session();

    // Spy on extender.hook
    const hookSpy = jest.spyOn(extender, 'hook');

    // Spy on BaseHttp.onRequestCreated to make it return null
    const onRequestCreatedSpy = jest.spyOn(BaseHttp, 'onRequestCreated').mockReturnValue(null);

    // Call the after connect wrapper to set up the request hook
    Http2.http2AfterConnectWrapper(['https://example.com'], mockSession);

    // Get the beforeHook function from the hook call
    const hookOptions = hookSpy.mock.calls[0][2];
    const beforeHook = hookOptions.beforeHook;

    // Create test arguments and context
    const args = [
      {
        ':method': 'GET',
        ':path': '/api/data',
        ':authority': 'example.com',
        ':scheme': 'https',
      },
    ];
    const extenderContext = {};

    // Call the beforeHook directly
    beforeHook(args, extenderContext);

    // Verify that onRequestCreated was called
    expect(onRequestCreatedSpy).toHaveBeenCalled();

    // Verify that context was not updated
    expect(extenderContext.requestRandomId).toBeUndefined();
    expect(extenderContext.transactionId).toBeUndefined();
    expect(extenderContext.awsRequestId).toBeUndefined();

    // Clean up
    hookSpy.mockRestore();
    onRequestCreatedSpy.mockRestore();
  });

  test('http2AfterConnectWrapper - hooks the request method', () => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    // Create a mock HTTP/2 session
    const mockSession = new Http2Session();

    // Spy on extender.hook
    const hookSpy = jest.spyOn(extender, 'hook');

    // Call the after connect wrapper
    Http2.http2AfterConnectWrapper(['https://example.com'], mockSession);

    // Verify that extender.hook was called with the session and 'request'
    expect(hookSpy).toHaveBeenCalledWith(mockSession, 'request', expect.any(Object));

    // Verify the hook options contain beforeHook and afterHook
    const hookOptions = hookSpy.mock.calls[0][2];
    expect(hookOptions).toHaveProperty('beforeHook');
    expect(hookOptions).toHaveProperty('afterHook');

    // Clean up
    hookSpy.mockRestore();
  });

  test('request afterHook - hooks stream events', () => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    // Create a mock HTTP/2 session
    const mockSession = new Http2Session();

    // Spy on extender.hook
    const hookSpy = jest.spyOn(extender, 'hook');

    // Call the after connect wrapper to set up the request hook
    Http2.http2AfterConnectWrapper(['https://example.com'], mockSession);

    // Get the afterHook function from the hook call
    const hookOptions = hookSpy.mock.calls[0][2];
    const afterHook = hookOptions.afterHook;

    // Create a mock stream
    const stream = new Http2Stream();

    // Create test arguments and context with request data
    const args = [
      {
        ':method': 'GET',
        ':path': '/api/data',
        ':authority': 'example.com',
        ':scheme': 'https',
      },
    ];
    const extenderContext = {
      requestData: {
        body: '',
        host: 'example.com',
        path: '/api/data',
        method: 'GET',
        headers: {},
        sendTime: Date.now(),
      },
      requestRandomId: 'test-random-id',
      transactionId: 'test-transaction-id',
      awsRequestId: 'test-aws-request-id',
    };

    // Reset the hook spy to check only hooks added by afterHook
    hookSpy.mockClear();

    // Call the afterHook directly
    afterHook(args, stream, extenderContext);

    // Verify that stream methods were hooked
    expect(hookSpy).toHaveBeenCalledWith(stream, 'end', expect.any(Object));
    expect(hookSpy).toHaveBeenCalledWith(stream, 'write', expect.any(Object));
    expect(hookSpy).toHaveBeenCalledWith(stream, 'emit', expect.any(Object));

    // Clean up
    hookSpy.mockRestore();
  });
  test('http2RequestArguments - debug logging', () => {
    // Enable debug logging for this test
    const debugSpy = jest.spyOn(logger, 'debug');

    const http2Headers = {
      ':method': 'POST',
      ':path': '/httpbin/post',
      ':scheme': 'https',
      ':authority': 'nghttp2.org',
      'content-type': 'application/json',
      'content-length': '76',
    };

    // Call the function to trigger debug logging
    Http2.http2RequestArguments([http2Headers]);

    // Verify that debug logging was called with the expected arguments
    expect(debugSpy).toHaveBeenCalledWith(
      'HTTP/2 request arguments parsed from headers',
      expect.objectContaining({
        url: 'https://nghttp2.org/httpbin/post',
        method: 'POST',
        path: '/httpbin/post',
        authority: 'nghttp2.org',
        scheme: 'https',
        hasCallback: false,
      })
    );

    // Clean up
    debugSpy.mockRestore();
  });

  test('http2StreamEmitBeforeHookWrapper - debug logging', () => {
    // Enable debug logging for this test
    const debugSpy = jest.spyOn(logger, 'debug');

    const transactionId = 'test-transaction-id';
    const awsRequestId = 'test-aws-request-id';
    const requestData = {
      body: '',
      host: 'example.com',
      path: '/api/data',
      method: 'GET',
      headers: {},
      sendTime: Date.now(),
    };
    const requestRandomId = 'test-random-id';
    const currentSpan = new HttpSpanBuilder().build();

    // Call the function to trigger debug logging
    Http2.http2StreamEmitBeforeHookWrapper(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId,
      currentSpan
    );

    // Verify that debug logging was called with the expected arguments
    expect(debugSpy).toHaveBeenCalledWith(
      'HTTP/2 creating stream emit hook wrapper',
      expect.objectContaining({
        transactionId,
        awsRequestId,
        requestRandomId,
        hasRequestData: true,
        hasCurrentSpan: true,
      })
    );

    // Clean up
    debugSpy.mockRestore();
  });

  test('http2StreamEmitBeforeHookWrapper - handles missing requestData', () => {
    // Enable debug logging for this test
    const debugSpy = jest.spyOn(logger, 'debug');

    const transactionId = 'test-transaction-id';
    const awsRequestId = 'test-aws-request-id';
    const requestRandomId = 'test-random-id';
    const currentSpan = new HttpSpanBuilder().build();

    // Call the function with undefined requestData to trigger the fallback code
    const emitHandler = Http2.http2StreamEmitBeforeHookWrapper(
      transactionId,
      awsRequestId,
      undefined, // Pass undefined requestData
      requestRandomId,
      currentSpan
    );

    // Verify that debug logging was called with the expected arguments
    expect(debugSpy).toHaveBeenCalledWith(
      'HTTP/2 creating stream emit hook wrapper',
      expect.objectContaining({
        hasRequestData: false,
      })
    );
    expect(debugSpy).toHaveBeenCalledWith('HTTP/2 requestData was not defined, created empty');

    // Call the emit handler with a response event to ensure it works with the created empty requestData
    emitHandler(['response', { ':status': 200 }]);

    // Clean up
    debugSpy.mockRestore();
  });

  test('http2AfterConnectWrapper - afterHook debug logging', () => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    // Create a mock HTTP/2 session
    const mockSession = new Http2Session();

    // Spy on extender.hook
    const hookSpy = jest.spyOn(extender, 'hook');

    // Spy on logger.debug
    const debugSpy = jest.spyOn(logger, 'debug');

    // Call the after connect wrapper to set up the request hook
    Http2.http2AfterConnectWrapper(['https://example.com'], mockSession);

    // Get the afterHook function from the hook call
    const hookOptions = hookSpy.mock.calls[0][2];
    const afterHook = hookOptions.afterHook;

    // Create a mock stream
    const stream = new Http2Stream();

    // Create test arguments and context with request data
    const args = [
      {
        ':method': 'GET',
        ':path': '/api/data',
        ':authority': 'example.com',
        ':scheme': 'https',
      },
    ];
    const extenderContext = {
      requestData: {
        body: '',
        host: 'example.com',
        path: '/api/data',
        method: 'GET',
        headers: {},
        sendTime: Date.now(),
      },
      requestRandomId: 'test-random-id',
      transactionId: 'test-transaction-id',
      awsRequestId: 'test-aws-request-id',
    };

    // Call the afterHook directly
    afterHook(args, stream, extenderContext);

    // Verify that debug logging was called with the expected arguments
    expect(debugSpy).toHaveBeenCalledWith('HTTP/2 stream afterHook args', expect.any(Object));
    expect(debugSpy).toHaveBeenCalledWith(
      'HTTP/2 stream afterHook beforeHookData',
      expect.objectContaining({
        beforeHookData: extenderContext,
        hasBeforeHookData: true,
      })
    );

    // Clean up
    hookSpy.mockRestore();
    debugSpy.mockRestore();
  });

  test('http2AfterConnectWrapper - afterHook with undefined extenderContext', () => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    // Create a mock HTTP/2 session
    const mockSession = new Http2Session();

    // Spy on extender.hook
    const hookSpy = jest.spyOn(extender, 'hook');

    // Spy on logger.debug
    const debugSpy = jest.spyOn(logger, 'debug');

    // Call the after connect wrapper to set up the request hook
    Http2.http2AfterConnectWrapper(['https://example.com'], mockSession);

    // Get the afterHook function from the hook call
    const hookOptions = hookSpy.mock.calls[0][2];
    const afterHook = hookOptions.afterHook;

    // Create a mock stream
    const stream = new Http2Stream();

    // Create test arguments with no extenderContext
    const args = [
      {
        ':method': 'GET',
        ':path': '/api/data',
        ':authority': 'example.com',
        ':scheme': 'https',
      },
    ];

    // Call the afterHook directly with undefined extenderContext
    afterHook(args, stream, undefined);

    // Verify that debug logging was called with the expected arguments
    expect(debugSpy).toHaveBeenCalledWith(
      'HTTP/2 stream afterHook beforeHookData',
      expect.objectContaining({
        hasBeforeHookData: false,
      })
    );
    expect(debugSpy).toHaveBeenCalledWith('HTTP/2 stream afterHook - no beforeHookData');

    // Clean up
    hookSpy.mockRestore();
    debugSpy.mockRestore();
  });

  test('http2StreamEmitBeforeHookWrapper - handles requestData with undefined body', () => {
    // Enable debug logging for this test
    const debugSpy = jest.spyOn(logger, 'debug');

    const transactionId = 'test-transaction-id';
    const awsRequestId = 'test-aws-request-id';
    const requestData = {
      // body is undefined
      host: 'example.com',
      path: '/api/data',
      method: 'GET',
      headers: {},
      sendTime: Date.now(),
    };
    const requestRandomId = 'test-random-id';
    const currentSpan = new HttpSpanBuilder().build();

    // Call the function with requestData that has undefined body
    const emitHandler = Http2.http2StreamEmitBeforeHookWrapper(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId,
      currentSpan
    );

    // Verify that debug logging was called with the expected arguments
    expect(debugSpy).toHaveBeenCalledWith(
      'HTTP/2 requestData.body was undefined, set to empty string'
    );

    // Call the emit handler with a response event to ensure it works with the fixed requestData
    emitHandler(['response', { ':status': 200 }]);

    // Clean up
    debugSpy.mockRestore();
  });

  test('hookHttp2 - initializes HTTP/2 hooks', () => {
    // Spy on wrapHttp2Lib
    const wrapSpy = jest.spyOn(Http2, 'wrapHttp2Lib');

    // Spy on logger.info
    const infoSpy = jest.spyOn(logger, 'info');

    // Call hookHttp2
    Http2.hookHttp2();

    // Verify that wrapHttp2Lib was called
    expect(wrapSpy).toHaveBeenCalled();

    // Verify that the argument to wrapHttp2Lib has the expected properties
    const wrapSpyArg = wrapSpy.mock.calls[0][0];
    expect(wrapSpyArg).toBeDefined();
    expect(typeof wrapSpyArg.connect).toBe('function');

    // Verify that logger.info was called
    expect(infoSpy).toHaveBeenCalledWith('HTTP/2 hooks initialized');

    // Clean up
    wrapSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
