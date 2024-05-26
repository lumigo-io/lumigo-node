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
    test('skip suite', () => {
      expect(true).toBe(true);
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
    'Should create matching span',
    async ({ method, protocol, host, reqHeaders, reqBody, resStatusCode, resHeaders, resBody }) => {
      fetchMock.mockResponseOnce(resBody, {
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
      if (resBody === undefined) {
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
      if (resBody === undefined) {
        expect(responseData.body).toEqual('');
      } else {
        expect(responseData.body).toEqual(resBody);
      }
    }
  );
});
