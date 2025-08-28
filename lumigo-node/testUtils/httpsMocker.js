const EventEmitter = require('events');

class Agent {}

export const HttpsScenarioBuilder = (() => {
  const defaultResponse = 'DummyDataChunk';
  let failForNext = 0;
  let nextResponse = [];
  let isNextRequestShouldFinish = true;
  let useEmit = false;

  const failForTheNextTimes = times => {
    failForNext += times;
  };

  const useEmitForNextResponse = () => {
    useEmit = true;
  };

  const isUseEmitForResponse = () => useEmit;

  const appendNextResponse = (requestContext, response) => {
    if (!requestContext && !HttpsScenarioBuilder.isUseEmitForResponse()) {
      nextResponse.push(response);
      return true;
    }
    const responseEmitter = new EventEmitter();
    responseEmitter.statusCode = 200;
    if (isObject(response) && 'headers' in response) {
      responseEmitter.headers = response.headers;
    }

    if (requestContext && requestContext.emit) {
      requestContext.emit('response', responseEmitter);
    }

    responseEmitter.emit('data', response);

    if (HttpsScenarioBuilder.isRequestShouldFinish()) {
      if (HttpsScenarioBuilder.isNextRequestFailed()) {
        responseEmitter.statusCode = 500;
        responseEmitter.emit('error', 'Error!');
      } else {
        responseEmitter.emit('end');
      }
    }
  };

  const getNextData = () => {
    const response = nextResponse.pop();
    return response ? response : defaultResponse;
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
    isNextRequestShouldFinish = true;
    useEmit = false;
  };

  return {
    failForTheNextTimes,
    isNextRequestFailed,
    clean,
    appendNextResponse,
    getNextData,
    isRequestShouldFinish,
    dontFinishNextRequest,
    useEmitForNextResponse,
    isUseEmitForResponse,
  };
})();

export const HttpsRequestsForTesting = (() => {
  let httpRequests = [];
  let startedRequests = 0;

  const getRequests = () => {
    return httpRequests;
  };

  const getStartedRequests = () => {
    return startedRequests;
  };

  const clean = () => {
    httpRequests = [];
    startedRequests = 0;
  };

  const pushRequest = request => {
    httpRequests.push(request);
  };

  const startRequest = () => {
    startedRequests++;
  };

  const getSentSpans = () => {
    return getRequests().map(req => JSON.parse(req.body)[0]);
  };

  return {
    getRequests,
    clean,
    pushRequest,
    getStartedRequests,
    startRequest,
    getSentSpans,
  };
})();

const isObject = a => !!a && a.constructor === Object;

export const HttpsMocker = (() => {
  const request = (options, callback) => {
    HttpsRequestsForTesting.startRequest();
    const callbackEmitter = new EventEmitter();
    const responseEmitter = new EventEmitter();
    const nextResponse = HttpsScenarioBuilder.getNextData();

    callbackEmitter.statusCode = 200;
    if (isObject(nextResponse) && 'headers' in nextResponse) {
      callbackEmitter.headers = nextResponse.headers;
    }

    callback && callback(callbackEmitter);

    if (nextResponse) callbackEmitter.emit('data', nextResponse);

    if (
      HttpsScenarioBuilder.isRequestShouldFinish() &&
      !HttpsScenarioBuilder.isUseEmitForResponse()
    ) {
      if (HttpsScenarioBuilder.isNextRequestFailed()) {
        responseEmitter.statusCode = 500;
        responseEmitter.emit('error', 'Error!');
      } else {
        callbackEmitter.emit('end');
      }
    }

    responseEmitter.write = body => {
      HttpsRequestsForTesting.pushRequest({
        options,
        body,
      });
    };

    responseEmitter.end = () => {};

    return responseEmitter;
  };

  return { request, Agent };
})();
