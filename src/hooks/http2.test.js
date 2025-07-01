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

// HTTP/2 mocking utilities
class Http2Stream extends EventEmitter {
  constructor() {
    super();
    this.headers = {};
    this.statusCode = 200;
  }

  write(data) {
    Http2RequestsForTesting.pushRequestData(data);
    return true;
  }

  end(data) {
    if (data) {
      Http2RequestsForTesting.pushRequestData(data);
    }
    return true;
  }
}

class Http2Session extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
  }

  request(headers = {}, options = {}) {
    Http2RequestsForTesting.startRequest();
    const stream = new Http2Stream();

    // Store the request details
    Http2RequestsForTesting.pushRequest({
      headers,
      options,
      stream,
    });

    // Schedule response handling based on scenario
    setTimeout(() => {
      if (Http2ScenarioBuilder.isRequestShouldFinish()) {
        const responseHeaders = Http2ScenarioBuilder.getNextResponseHeaders();
        stream.emit('headers', responseHeaders);

        const responseData = Http2ScenarioBuilder.getNextData();
        if (responseData) {
          stream.emit('data', responseData);
        }

        if (!Http2ScenarioBuilder.isNextRequestFailed()) {
          stream.emit('end');
        } else {
          stream.emit('error', new Error('HTTP/2 stream error'));
        }
      }
    }, 0);

    return stream;
  }

  close() {
    this.destroyed = true;
    this.emit('close');
  }
}

export const Http2ScenarioBuilder = (() => {
  const defaultResponse = 'DummyDataChunk';
  let failForNext = 0;
  let nextResponse = [];
  let nextResponseHeaders = [];
  let isNextRequestShouldFinish = true;

  const failForTheNextTimes = (times) => {
    failForNext += times;
  };

  const appendNextResponse = (responseData, responseHeaders = { ':status': 200 }) => {
    nextResponse.push(responseData);
    nextResponseHeaders.push(responseHeaders);
  };

  const getNextData = () => {
    const response = nextResponse.pop();
    return response ? response : defaultResponse;
  };

  const getNextResponseHeaders = () => {
    const headers = nextResponseHeaders.pop();
    return headers || { ':status': 200 };
  };

  const isRequestShouldFinish = () => {
    if (isNextRequestShouldFinish) return true;
    isNextRequestShouldFinish = true;
    return false;
  };

  const dontFinishNextRequest = () => {
    isNextRequestShouldFinish = false;
  };

  const isNextRequestFailed = () => {
    if (failForNext > 0) {
      failForNext--;
      return true;
    }
    return false;
  };

  const clean = () => {
    failForNext = 0;
    nextResponse = [];
    nextResponseHeaders = [];
    isNextRequestShouldFinish = true;
  };

  return {
    failForTheNextTimes,
    isNextRequestFailed,
    clean,
    appendNextResponse,
    getNextData,
    getNextResponseHeaders,
    isRequestShouldFinish,
    dontFinishNextRequest,
  };
})();

export const Http2RequestsForTesting = (() => {
  let http2Requests = [];
  let startedRequests = 0;
  let requestData = [];

  const getRequests = () => {
    return http2Requests;
  };

  const getStartedRequests = () => {
    return startedRequests;
  };

  const getRequestData = () => {
    return requestData;
  };

  const clean = () => {
    http2Requests = [];
    startedRequests = 0;
    requestData = [];
  };

  const pushRequest = (request) => {
    http2Requests.push(request);
  };

  const pushRequestData = (data) => {
    requestData.push(data);
  };

  const startRequest = () => {
    startedRequests++;
  };

  return {
    getRequests,
    getRequestData,
    clean,
    pushRequest,
    pushRequestData,
    getStartedRequests,
    startRequest,
  };
})();

export const Http2Mocker = (() => {
  const connect = (authority, options = {}, listener) => {
    Http2RequestsForTesting.startRequest();
    const session = new Http2Session();

    if (typeof options === 'function') {
      listener = options;
      options = {};
    }

    if (listener) {
      session.on('connect', listener);
    }

    // Emit connect event on next tick
    setTimeout(() => {
      session.emit('connect', session);
    }, 0);

    return session;
  };

  const createSecureClient = connect;

  return {
    connect,
    createSecureClient,
    constants: {
      HTTP2_HEADER_METHOD: ':method',
      HTTP2_HEADER_PATH: ':path',
      HTTP2_HEADER_AUTHORITY: ':authority',
      HTTP2_HEADER_SCHEME: ':scheme',
      HTTP2_HEADER_STATUS: ':status',
    },
  };
})();

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
      new Error('http2.connect(...) was called without any arguments.')
    );
  });

  test('http2RequestArguments -> http2(stringUrl)', () => {
    const expected1 = {
      url: 'https://x.com',
      options: undefined,
    };
    expect(Http2.http2RequestArguments(['https://x.com'])).toEqual(expected1);
  });

  test('http2RequestArguments -> http2(stringUrl, callback)', () => {
    const callback = () => {};

    const expected2 = {
      url: 'https://x.com',
      options: undefined,
    };
    expect(Http2.http2RequestArguments(['https://x.com', callback])).toEqual(expected2);
  });

  test('http2RequestArguments -> http2(stringUrl, options, callback)', () => {
    const callback = () => {};
    const options = { a: 'b' };
    const expected3 = {
      url: 'https://x.com',
      options,
    };
    expect(Http2.http2RequestArguments(['https://x.com', options, callback])).toEqual(expected3);
  });

  test('http2RequestArguments -> http2(options, callback)', () => {
    const callback = () => {};
    const options = { a: 'b' };
    const expected4 = {
      url: undefined,
      options,
    };
    expect(Http2.http2RequestArguments([options, callback])).toEqual(expected4);
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
      },
    };

    expect(Http2.http2RequestArguments([http2Headers])).toEqual(expected);
  });

  test('addOptionsToHttp2RequestArguments', () => {
    // This test goes over all the options of inputs to: https://nodejs.org/api/http2.html#http2connectauthority-options-listener
    const url = 'https://example.com';
    const callback = () => {};
    const newOptions = { a: 'b' };

    // http2.connect(url)
    const originalArgs0 = [url];
    const expected0 = [url, newOptions];
    Http2.addOptionsToHttp2RequestArguments(originalArgs0, newOptions);
    expect(originalArgs0).toEqual(expected0);

    // http2.connect(url, callback)
    const originalArgs1 = [url, callback];
    const expected1 = [url, newOptions, callback];
    Http2.addOptionsToHttp2RequestArguments(originalArgs1, newOptions);
    expect(originalArgs1).toEqual(expected1);

    // http2.connect(url, options)
    const originalArgs2 = [url, { c: 'd' }];
    const expected2 = [url, newOptions];
    Http2.addOptionsToHttp2RequestArguments(originalArgs2, newOptions);
    expect(originalArgs2).toEqual(expected2);

    // http2.connect(url, options, callback)
    const originalArgs3 = [url, { c: 'd' }, callback];
    const expected3 = [url, newOptions, callback];
    Http2.addOptionsToHttp2RequestArguments(originalArgs3, newOptions);
    expect(originalArgs3).toEqual(expected3);

    // http2.connect(options)
    const originalArgs4 = [{ c: 'd' }];
    const expected4 = [newOptions];
    Http2.addOptionsToHttp2RequestArguments(originalArgs4, newOptions);
    expect(originalArgs4).toEqual(expected4);
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

  test('wrapHttp2Lib - adding W3C headers', () => {
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

    // Verify that W3C headers were added
    const requests = Http2RequestsForTesting.getRequests();
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0].headers[TRACESTATE_HEADER_NAME]).toBeDefined();
  });

  test('http2StreamEmitBeforeHookWrapper - handles headers event', (done) => {
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

    // Create a mock HTTP/2 stream
    const stream = new Http2Stream();

    // Create the response handler directly
    const responseHandler = Http2.createEmitResponseHandler(
      transactionId,
      awsRequestId,
      requestData,
      requestRandomId
    );

    // Apply the response handler to the stream
    responseHandler(stream);

    // Emit the response events
    stream.emit('headers', { ':status': 200, 'content-type': 'application/json' });
    stream.emit('data', 'test-response-data');
    stream.emit('end');

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

  test('http2BeforeRequestWrapper - adds headers to request', () => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);

    const args = ['https://example.com', { headers: {} }];
    const extenderContext = {};

    Http2.http2BeforeConnectWrapper(args, extenderContext);

    // Verify that headers were added
    expect(args[1].headers).toBeDefined();
    expect(Object.keys(args[1].headers).length).toBeGreaterThan(0);

    // Verify that context was updated
    expect(extenderContext.isTracedDisabled).toBe(false);
    expect(extenderContext.requestRandomId).toBeDefined();
    expect(extenderContext.transactionId).toBeDefined();
    expect(extenderContext.awsRequestId).toBeDefined();
  });
});
