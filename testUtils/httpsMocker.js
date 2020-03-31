const EventEmitter = require('events');

export const HttpsScenarioBuilder = (() => {
  const defaultResponse = 'DummyDataChunk';
  let failForNext = 0;
  let nextResponse = [];
  let isNextRequestShouldFinish = true;

  const failForTheNextTimes = times => {
    failForNext += times;
  };

  const appendNextResponse = response => {
    nextResponse.push(response);
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
  };

  return {
    defaultResponse,
    failForTheNextTimes,
    isNextRequestFailed,
    clean,
    appendNextResponse,
    getNextData,
    isRequestShouldFinish,
    dontFinishNextRequest,
  };
})();

export const HttpsRequestsForTesting = (() => {
  let httpRequests = [];

  const getRequests = () => {
    return httpRequests;
  };

  const clean = () => {
    httpRequests = [];
  };

  const pushRequest = request => {
    httpRequests.push(request);
  };

  return { getRequests, clean, pushRequest };
})();

export const HttpsMocker = (() => {
  const request = (options, callback) => {
    const callbackEmitter = new EventEmitter();
    const responseEmitter = new EventEmitter();
    callbackEmitter.statusCode = 200;

    callback(callbackEmitter);

    const nextResponse = HttpsScenarioBuilder.getNextData();
    if (nextResponse) callbackEmitter.emit('data', nextResponse);

    if (HttpsScenarioBuilder.isRequestShouldFinish()) {
      if (HttpsScenarioBuilder.isNextRequestFailed()) {
        responseEmitter.statusCode = 500;
        responseEmitter.emit('error', 'Whoops!');
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

  return { request };
})();

export const cleanHttpMocker = () => {};
