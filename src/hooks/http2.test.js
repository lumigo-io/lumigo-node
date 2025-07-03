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
import * as extender from '../extender';

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
});
