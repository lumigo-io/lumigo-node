import { mockFetchGlobal } from '../../testUtils/fetchMocker';
import { FetchSpanBuilder } from '../../testUtils/fetchSpanBuilder';
import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { payloadStringify } from '../utils/payloadStringify';
import { hookFetch } from './fetch';

const TEST_URL_HOST = 'www.google.com';
const TEST_URL_ROUTE = '/';
const TEST_URL = `https://${TEST_URL_HOST}${TEST_URL_ROUTE}`;

const waitForSpans = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

describe('fetch', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hook fetch -> get text flow', async () => {
    const responseHeaders = { 'Content-Type': 'text/plain' };
    const responseText = 'get request response text';
    mockFetchGlobal({
      status: 200,
      headers: responseHeaders,
      body: responseText,
    });
    hookFetch();

    const response = await fetch(TEST_URL);
    expect(response.ok).toEqual(true);
    expect(await response.text()).toEqual(responseText);

    await waitForSpans();
    const spans = SpansContainer.getSpans();

    const expectedSpan = new FetchSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withHost(TEST_URL_HOST)
      .withRoute(TEST_URL_ROUTE)
      .withUrl(payloadStringify(TEST_URL))
      .withMethod('GET')
      .withOptions(payloadStringify({}))
      .withStatusCode(200)
      .withResponseHeaders(payloadStringify(responseHeaders))
      .withResponseBody(payloadStringify(responseText))
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hook fetch -> get json flow', async () => {
    const responseHeaders = { 'Content-Type': 'application/json' };
    const responseJson = { a: 1, b: 2 };
    mockFetchGlobal({
      status: 200,
      body: responseJson,
      headers: responseHeaders,
    });
    hookFetch();

    const response = await fetch(TEST_URL);
    expect(response.ok).toEqual(true);
    expect(await response.json()).toEqual(responseJson);

    await waitForSpans();
    const spans = SpansContainer.getSpans();

    const expectedSpan = new FetchSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withHost(TEST_URL_HOST)
      .withRoute(TEST_URL_ROUTE)
      .withUrl(payloadStringify(TEST_URL))
      .withMethod('GET')
      .withOptions(payloadStringify({}))
      .withStatusCode(200)
      .withResponseHeaders(payloadStringify(responseHeaders))
      .withResponseBody(payloadStringify(responseJson))
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hook fetch -> post text flow', async () => {
    const responseHeaders = { 'Content-Type': 'text/plain' };
    const responseText = 'post request response text';
    mockFetchGlobal({
      status: 200,
      body: responseText,
      headers: responseHeaders,
    });
    hookFetch();

    const requestText = 'post request text';
    const requestHeaders = { 'Content-Type': 'text/plain' };
    const fetchOptions = {
      headers: requestHeaders,
      method: 'POST',
      body: requestText,
    };

    const response = await fetch(TEST_URL, fetchOptions);
    expect(response.ok).toEqual(true);
    expect(await response.text()).toEqual(responseText);

    await waitForSpans();
    const spans = SpansContainer.getSpans();

    const expectedSpan = new FetchSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withHost(TEST_URL_HOST)
      .withRoute(TEST_URL_ROUTE)
      .withUrl(payloadStringify(TEST_URL))
      .withMethod(fetchOptions.method)
      .withOptions(payloadStringify(fetchOptions))
      .withRequestHeaders(payloadStringify(requestHeaders))
      .withRequestBody(payloadStringify(requestText))
      .withStatusCode(200)
      .withResponseHeaders(payloadStringify(responseHeaders))
      .withResponseBody(payloadStringify(responseText))
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hook fetch -> post json flow', async () => {
    const responseHeaders = { 'Content-Type': 'application/json' };
    const responseJson = {
      hello: 'to you too',
    };
    mockFetchGlobal({
      status: 200,
      body: responseJson,
      headers: responseHeaders,
    });
    hookFetch();

    const requestJson = {
      hello: 'world',
    };
    const requestHeaders = { 'Content-Type': 'application/json' };
    const fetchOptions = {
      headers: requestHeaders,
      method: 'POST',
      body: requestJson,
    };

    const response = await fetch(TEST_URL, fetchOptions);
    expect(response.ok).toEqual(true);
    expect(await response.json()).toEqual(responseJson);

    await waitForSpans();
    const spans = SpansContainer.getSpans();

    const expectedSpan = new FetchSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withHost(TEST_URL_HOST)
      .withRoute(TEST_URL_ROUTE)
      .withUrl(payloadStringify(TEST_URL))
      .withMethod(fetchOptions.method)
      .withOptions(payloadStringify(fetchOptions))
      .withRequestHeaders(payloadStringify(requestHeaders))
      .withRequestBody(payloadStringify(requestJson))
      .withStatusCode(200)
      .withResponseHeaders(payloadStringify(responseHeaders))
      .withResponseBody(payloadStringify(responseJson))
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test.each([
    [
      'status text and body',
      'Not found',
      'You seem to be lost!',
      'Not found: "You seem to be lost!"',
    ],
    ['status text only', 'Not found', undefined, 'Not found'],
    ['body only', undefined, 'You seem to be lost!', '"You seem to be lost!"'],
  ])('hook fetch -> get not found: %s', async (testCase, statusText, body, responseError) => {
    const mockerOptions = {
      status: 404,
    };
    if (statusText) {
      mockerOptions.statusText = statusText;
    }
    if (body) {
      mockerOptions.body = body;
    }
    mockFetchGlobal(mockerOptions);

    hookFetch();

    const response = await fetch(TEST_URL);
    expect(response.ok).toEqual(false);
    expect(response.statusText).toEqual(statusText);
    expect(response.text()).resolves.toEqual(body);

    await waitForSpans();
    const spans = SpansContainer.getSpans();

    const expectedSpan = new FetchSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withHost(TEST_URL_HOST)
      .withRoute(TEST_URL_ROUTE)
      .withUrl(payloadStringify(TEST_URL))
      .withMethod('GET')
      .withOptions(payloadStringify({}))
      .withStatusCode(404)
      .withError(responseError)
      .build();
    expect(spans).toEqual([expectedSpan]);
  });
});
