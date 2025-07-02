import EventEmitter from 'events';

/**
 * Mock implementation of HTTP/2 stream for testing
 */
export class Http2Stream extends EventEmitter {
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

/**
 * Mock implementation of HTTP/2 session for testing
 */
export class Http2Session extends EventEmitter {
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

/**
 * Builder for creating HTTP/2 test scenarios
 */
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

/**
 * Collector for HTTP/2 requests during tests
 */
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

/**
 * Main HTTP/2 mocker that simulates the Node.js http2 module
 */
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