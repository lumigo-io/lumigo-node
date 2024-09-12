import { NODE_MAJOR_VERSION } from '../../testUtils/nodeVersion';
import fetchMock from 'jest-fetch-mock';
import { FetchInstrumentation } from './fetch';
import { SpansContainer } from '../globals';

fetchMock.enableMocks();

describe('fetch', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    fetchMock.resetMocks();
    FetchInstrumentation.startInstrumentation();
  });

  afterEach(() => {
    FetchInstrumentation.stopInstrumentation();
  });

  if (NODE_MAJOR_VERSION < 18) {
    test('start instrumenting fetch - fetch not available', () => {
      // make sure no errors are thrown
      FetchInstrumentation.startInstrumentation();
    });

    test('stop instrumenting fetch - fetch not available', () => {
      // make sure no errors are thrown
      FetchInstrumentation.stopInstrumentation();
    });
    return;
  }

  const protocols = ['http:', 'https:'];
  const statusCodes = [
    200, 201, 202, 300, 301, 302, 303, 304, 307, 308, 400, 401, 403, 404, 405, 500, 501, 503,
  ];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'];
  const responseBodies = [
    JSON.stringify({ data: '12345' }),
    JSON.stringify({ error: 'Error message' }),
    undefined,
    'Not a JSON response',
  ];
  const cases = [];
  for (const protocol of protocols) {
    for (const method of methods) {
      for (const statusCode of statusCodes) {
        for (const responseBody of responseBodies) {
          cases.push([
            {
              method: method,
              protocol: protocol,
              host: 'example.com',
              reqHeaders: {},
              reqBody: undefined,
              resStatusCode: statusCode,
              resHeaders: { 'content-type': 'application/json' },
              resBody: responseBody,
            },
          ]);
        }
      }
    }
  }

  test.each([...cases])(
    'Test basic http span creation: %p',
    async ({ method, protocol, host, reqHeaders, reqBody, resStatusCode, resHeaders, resBody }) => {
      // Handle 304 or other status codes that shouldn't have a body
      const bodyForMock = resStatusCode === 304 ? null : resBody;

      fetchMock.mockResponseOnce(bodyForMock, {
        status: resStatusCode,
        headers: resHeaders,
      });

      SpansContainer.clearSpans();
      expect(SpansContainer.getSpans().length).toBe(0);

      // @ts-ignore
      const response: Response = await fetch(`${protocol}//${host}/`, {
        method,
        headers: reqHeaders,
        body: reqBody,
      });
      const body = await response.text();
      // Ensure that a 304 or similar response has no body
      if (resBody === undefined || resStatusCode === 304) {
        expect(body).toEqual('');
      } else {
        expect(body).toEqual(resBody);
      }

      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const spans = SpansContainer.getSpans();
      if (spans.length > 1) {
        console.log(spans);
      }
      expect(spans.length).toBe(1);
      const actualSpan = spans[0];
      expect(actualSpan.transactionId).toBeTruthy();
      // @ts-ignore
      expect(actualSpan.info.httpInfo.host).toBe(host);
      // @ts-ignore
      const requestData = actualSpan.info.httpInfo.request;
      // @ts-ignore
      const responseData = actualSpan.info.httpInfo.response;

      // Verify span has all the required request data
      expect(requestData.truncated).toEqual(false);
      expect(requestData.method).toEqual(method);
      expect(requestData.uri).toEqual(`${host}/`);
      expect(requestData.host).toEqual(host);
      expect(requestData.protocol).toEqual(protocol);
      expect(requestData.headers.traceparent).toBeTruthy();
      if (reqBody === undefined) {
        expect(requestData.body).toEqual('');
      } else {
        expect(requestData.body).toEqual(reqBody);
      }

      // Verify span has all the required response data
      expect(responseData.truncated).toEqual(false);
      expect(responseData.statusCode).toEqual(response.status);
      expect(responseData.statusCode).toEqual(resStatusCode);
      expect(responseData.headers).toEqual(responseHeaders);
      expect(responseData.headers).toEqual(resHeaders);

      // Ensure that a 304 or similar response has no body
      if (resBody === undefined || resStatusCode === 304) {
        expect(body).toEqual('');
      } else {
        expect(body).toEqual(resBody);
      }
    }
  );

  test('Test large response body', async () => {
    const responseHeaders = { 'content-type': 'application/json' };
    const responseStatusCode = 200;
    const responseBody = JSON.stringify({ data: 'x'.repeat(1000000) });
    fetchMock.mockResponseOnce(responseBody, {
      status: responseStatusCode,
      headers: responseHeaders,
    });

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // @ts-ignore
    const response = await fetch('http://example.com/');
    expect(response.status).toBe(responseStatusCode);

    const body = await response.text();
    expect(body).toEqual(responseBody);

    const spans = SpansContainer.getSpans();
    expect(spans.length).toBe(1);
    const actualSpan = spans[0];
    // @ts-ignore
    const requestData = actualSpan.info.httpInfo.request;
    // @ts-ignore
    const responseData = actualSpan.info.httpInfo.response;

    expect(responseData.body.length).toBeLessThan(responseBody.length);
    expect(responseData.body).toEqual(responseBody.slice(0, responseData.body.length));
    expect(responseData.truncated).toEqual(true);

    // Verify span has all the required request data
    expect(requestData.truncated).toEqual(false);
    expect(requestData.method).toEqual('GET');
    expect(requestData.uri).toEqual(`example.com/`);
    expect(requestData.host).toEqual('example.com');
    expect(requestData.protocol).toEqual('http:');
    expect(requestData.headers.traceparent).toBeTruthy();
  });

  test('Test failsafe hooks - before fetch', async () => {
    const responseHeaders = { 'content-type': 'application/json' };
    const responseStatusCode = 200;
    const responseBody = JSON.stringify({ data: '12345' });
    fetchMock.mockResponseOnce(responseBody, {
      status: responseStatusCode,
      headers: responseHeaders,
    });

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // @ts-ignore
    const originalBeforeFetch = FetchInstrumentation.beforeFetch;

    // @ts-ignore
    FetchInstrumentation.beforeFetch = () => {
      throw new Error('beforeFetch error');
    };

    // @ts-ignore
    const response = await fetch('http://example.com/');
    // @ts-ignore
    FetchInstrumentation.beforeFetch = originalBeforeFetch;

    expect(response.status).toBe(responseStatusCode);

    const body = await response.text();
    expect(body).toEqual(responseBody);

    const actualResponseHeaders = {};
    response.headers.forEach((value, key) => {
      actualResponseHeaders[key] = value;
    });

    expect(actualResponseHeaders).toEqual(responseHeaders);

    expect(SpansContainer.getSpans().length).toBe(0);
  });

  test('Test failsafe hooks - create response span', async () => {
    const responseHeaders = { 'content-type': 'application/json' };
    const responseStatusCode = 200;
    const responseBody = JSON.stringify({ data: '12345' });
    fetchMock.mockResponseOnce(responseBody, {
      status: responseStatusCode,
      headers: responseHeaders,
    });

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // @ts-ignore
    const originalCreateResponseSpan = FetchInstrumentation.createResponseSpan;
    // @ts-ignore
    FetchInstrumentation.createResponseSpan = () => {
      throw new Error('createResponseSpan error');
    };

    // @ts-ignore
    const response = await fetch('http://example.com/');
    // @ts-ignore
    FetchInstrumentation.createResponseSpan = originalCreateResponseSpan;

    expect(response.status).toBe(responseStatusCode);

    const body = await response.text();
    expect(body).toEqual(responseBody);

    const actualResponseHeaders = {};
    response.headers.forEach((value, key) => {
      actualResponseHeaders[key] = value;
    });

    expect(actualResponseHeaders).toEqual(responseHeaders);

    const spans = SpansContainer.getSpans();
    expect(spans.length).toBe(1);
    const actualSpan = spans[0];
    // @ts-ignore
    const requestData = actualSpan.info.httpInfo.request;
    // @ts-ignore
    const responseData = actualSpan.info.httpInfo.response;

    expect(responseData).toEqual({});

    // Verify span has all the required request data
    expect(requestData.truncated).toEqual(false);
    expect(requestData.method).toEqual('GET');
    expect(requestData.uri).toEqual(`example.com/`);
    expect(requestData.host).toEqual('example.com');
    expect(requestData.protocol).toEqual('http:');
    expect(requestData.headers.traceparent).toBeTruthy();
  });

  test('Test request body with binary file', async () => {
    const responseHeaders = { 'content-type': 'application/json' };
    const responseStatusCode = 200;
    const responseBody = JSON.stringify({ data: '12345' });
    fetchMock.mockResponseOnce(responseBody, {
      status: responseStatusCode,
      headers: responseHeaders,
    });

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // Send POST request with binary data
    // @ts-ignore
    const response = await fetch('http://example.com/', {
      method: 'POST',
      // @ts-ignore
      body: new Blob(['Blob contents']),
    });

    expect(response.status).toBe(responseStatusCode);

    const actualResponseHeaders = {};
    response.headers.forEach((value, key) => {
      actualResponseHeaders[key] = value;
    });

    expect(actualResponseHeaders).toEqual(responseHeaders);

    const spans = SpansContainer.getSpans();
    expect(spans.length).toBe(1);
    const actualSpan = spans[0];
    // @ts-ignore
    const requestData = actualSpan.info.httpInfo.request;

    // Verify span has all the required request data
    expect(requestData.truncated).toEqual(false);
    expect(requestData.method).toEqual('POST');
    expect(requestData.uri).toEqual(`example.com/`);
    expect(requestData.host).toEqual('example.com');
    expect(requestData.protocol).toEqual('http:');
    expect(requestData.headers.traceparent).toBeTruthy();
    expect(requestData.body).toEqual('Blob contents');
  });

  test('Test response body with binary file', async () => {
    // @ts-ignore
    const responseBody = new Blob(['Blob contents']);
    fetchMock.mockResponseOnce(responseBody, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // @ts-ignore
    await fetch('http://example.com/');

    const spans = SpansContainer.getSpans();
    expect(spans.length).toBe(1);
    const actualSpan = spans[0];
    // @ts-ignore
    const requestData = actualSpan.info.httpInfo.request;

    // Verify span has all the required request data
    expect(requestData.truncated).toEqual(false);
    expect(requestData.method).toEqual('GET');
    expect(requestData.uri).toEqual(`example.com/`);
    expect(requestData.host).toEqual('example.com');
    expect(requestData.protocol).toEqual('http:');
    expect(requestData.headers.traceparent).toBeTruthy();
    expect(requestData.body).toEqual('');
  });

  test('Test exception in fetch command', async () => {
    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    fetchMock.mockRejectOnce(new Error('Fetch error'));

    try {
      // @ts-ignore
      await fetch('http://example.com/');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toEqual('Fetch error');
    }
  });

  test('Test fetch command timing', async () => {
    const expectedRequestDuration = 1000;

    // If the test is flaky due to timing issues, increase the margin
    const timeMeasureMargin = 20;
    fetchMock.mockResponseOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(JSON.stringify({ data: 'Your response data' })),
            expectedRequestDuration
          )
        )
    );

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // @ts-ignore
    await fetch('http://example.com/');
    const spans = SpansContainer.getSpans();
    expect(spans.length).toBe(1);
    const actualSpan = spans[0];

    // @ts-ignore
    const durationMs = actualSpan.ended - actualSpan.started;

    expect(durationMs).toBeGreaterThanOrEqual(expectedRequestDuration - timeMeasureMargin);
    expect(durationMs).toBeLessThanOrEqual(expectedRequestDuration + timeMeasureMargin);
  });

  test('Test blacklisted host not creating span', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ data: '12345' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // @ts-ignore
    await fetch('http://127.0.0.1/');

    const spans = SpansContainer.getSpans();
    expect(spans.length).toBe(0);
  });

  test('Fetch with different arguments formats', async () => {
    const responseHeaders = { 'content-type': 'application/json' };
    const responseStatusCode = 200;
    const responseBody = JSON.stringify({ data: '12345' });
    fetchMock.mockResponseOnce(responseBody, {
      status: responseStatusCode,
      headers: responseHeaders,
    });

    SpansContainer.clearSpans();
    expect(SpansContainer.getSpans().length).toBe(0);

    // @ts-ignore
    await fetch(new Request('http://example.com/'), {
      method: 'GET',
    });

    const spans = SpansContainer.getSpans();
    expect(spans.length).toBe(1);
    const actualSpan = spans[0];
    // @ts-ignore
    const requestData = actualSpan.info.httpInfo.request;
    // @ts-ignore
    const responseData = actualSpan.info.httpInfo.response;

    // Verify span has all the required request data
    expect(requestData.truncated).toEqual(false);
    expect(requestData.method).toEqual('GET');
    expect(requestData.uri).toEqual(`example.com/`);
    expect(requestData.host).toEqual('example.com');
    expect(requestData.protocol).toEqual('http:');
    expect(requestData.headers.traceparent).toBeTruthy();

    // Verify span has all the required response data
    expect(responseData.truncated).toEqual(false);
    expect(responseData.statusCode).toEqual(responseStatusCode);
    expect(responseData.headers).toEqual(responseHeaders);
    expect(responseData.body).toEqual(responseBody);
  });

  test('Test convertHeadersToKeyValuePairs - Headers input', () => {
    // @ts-ignore
    const headers = new Headers({
      'content-type': 'application/json',
      'content-length': '12345',
    });
    // @ts-ignore
    const parsedHeaders = FetchInstrumentation.convertHeadersToKeyValuePairs(headers);
    expect(parsedHeaders).toEqual({
      'content-type': 'application/json',
      'content-length': '12345',
    });
  });

  test('Test convertHeadersToKeyValuePairs - Record<string, string> input', () => {
    const headers = {
      'content-type': 'application/json',
      'content-length': '12345',
    };
    // @ts-ignore
    const parsedHeaders = FetchInstrumentation.convertHeadersToKeyValuePairs(headers);
    expect(parsedHeaders).toEqual({
      'content-type': 'application/json',
      'content-length': '12345',
    });
  });

  test('Test convertHeadersToKeyValuePairs - string[][] input', () => {
    const headers = [
      ['content-type', 'application/json'],
      ['content-length', '12345'],
    ];
    // @ts-ignore
    const parsedHeaders = FetchInstrumentation.convertHeadersToKeyValuePairs(headers);
    expect(parsedHeaders).toEqual({
      'content-type': 'application/json',
      'content-length': '12345',
    });
  });

  test('Test addHeadersToFetchArguments - only input given', () => {
    const expectedHeaders = {
      'content-type': 'application/json',
      'content-length': '12345',
    };
    const options = {
      method: 'GET',
      headers: expectedHeaders,
    };
    // @ts-ignore
    const input = 'https://example.com';
    const init = undefined;
    // @ts-ignore
    const { input: newInput, init: newInit } = FetchInstrumentation.addHeadersToFetchArguments({
      input,
      init,
      options,
    });
    expect(newInput).toEqual(input);
    expect(newInit).toEqual({
      headers: expectedHeaders,
    });
  });

  test('Test addHeadersToFetchArguments - init value given', () => {
    const headersToAdd = {
      'content-type': 'application/json',
      'content-length': '12345',
    };
    const options = {
      method: 'GET',
      headers: headersToAdd,
    };
    // @ts-ignore
    const input = 'https://example.com';
    const init = {
      method: 'PUT',
      headers: {
        // This key exists in the options object, so it will be overridden
        'content-type': 'application/xml',
        // This key does not exist in the options object, so it will be kept i the new input object
        'new-header': 'new-value',
      },
      body: JSON.stringify({ data: '54321' }),
    };
    // @ts-ignore
    const { input: newInput, init: newInit } = FetchInstrumentation.addHeadersToFetchArguments({
      input,
      init,
      options,
    });
    expect(newInput).toEqual(input);
    expect(newInit).toEqual({
      method: 'PUT',
      headers: { ...headersToAdd, 'new-header': 'new-value' },
      body: JSON.stringify({ data: '54321' }),
    });
  });

  test('attach hooks twice', () => {
    // @ts-ignore
    const originalFetchBefore = fetch.__originalFetch;
    // We already attached once in the before stage of the test, so this is the second time
    // @ts-ignore
    FetchInstrumentation.attachHooks();
    // @ts-ignore
    expect(fetch.__originalFetch).toBe(originalFetchBefore);
  });

  test('remove hooks twice', () => {
    // @ts-ignore
    const originalFetchBefore = fetch.__originalFetch;
    // We already removed once in the before stage of the test, so this is the second time
    // @ts-ignore
    FetchInstrumentation.removeHooks();
    // @ts-ignore
    expect(fetch).toBe(originalFetchBefore);
    // @ts-ignore
    FetchInstrumentation.removeHooks();
    // @ts-ignore
    expect(fetch).toBe(originalFetchBefore);
  });
});
