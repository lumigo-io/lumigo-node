import { FetchInstrumentation } from './fetch';
import { convertHeadersToKeyValuePairs } from './fetchUtils';

describe('fetchUtils', () => {
  test('Test convertHeadersToKeyValuePairs - Headers input', () => {
    // @ts-ignore
    const headers = new Headers({
      'content-type': 'application/json',
      'content-length': '12345',
    });
    // @ts-ignore
    const parsedHeaders = convertHeadersToKeyValuePairs(headers);
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
    const parsedHeaders = convertHeadersToKeyValuePairs(headers);
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
    const parsedHeaders = convertHeadersToKeyValuePairs(headers);
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

  test.each([
    [
      {
        input: 'https://example.com',
        init: undefined,
        expectedUrl: 'https://example.com',
        expectedOptions: {
          method: 'GET',
          headers: {},
        },
      },
    ],
    [
      {
        input: new URL('https://example.com'),
        init: undefined,
        expectedUrl: 'https://example.com/',
        expectedOptions: {
          method: 'GET',
          headers: {},
        },
      },
    ],
    [
      {
        input: new URL('https://example.com/'),
        init: undefined,
        expectedUrl: 'https://example.com/',
        expectedOptions: {
          method: 'GET',
          headers: {},
        },
      },
    ],
    [
      {
        // @ts-ignore
        input: new Request('https://example.com'),
        init: undefined,
        expectedUrl: 'https://example.com/',
        expectedOptions: {
          method: 'GET',
          headers: {},
        },
      },
    ],
    [
      {
        // @ts-ignore
        input: new Request(new URL('https://example.com')),
        init: undefined,
        expectedUrl: 'https://example.com/',
        expectedOptions: {
          method: 'GET',
          headers: {},
        },
      },
    ],
    [
      {
        // @ts-ignore
        input: new Request('https://example.com', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: '12345' }),
        }),
        init: undefined,
        expectedUrl: 'https://example.com/',
        expectedOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: '12345' }),
        },
      },
    ],
    // Here we will add the init object, making sure it overrides the input values
    [
      {
        // @ts-ignore
        input: new Request('https://example.com', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: '12345' }),
        }),
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          body: JSON.stringify({ data: '54321' }),
        },
        expectedUrl: 'https://example.com/',
        expectedOptions: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          body: JSON.stringify({ data: '54321' }),
        },
      },
    ],
    [
      {
        input: 'https://example.com',
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          body: JSON.stringify({ data: '54321' }),
        },
        expectedUrl: 'https://example.com',
        expectedOptions: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          body: JSON.stringify({ data: '54321' }),
        },
      },
    ],
    [
      {
        input: new URL('https://example.com'),
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          body: JSON.stringify({ data: '54321' }),
        },
        expectedUrl: 'https://example.com/',
        expectedOptions: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          body: JSON.stringify({ data: '54321' }),
        },
      },
    ],
    // Test different formats for body
    [
      {
        input: 'https://example.com',
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          // @ts-ignore
          body: new Blob(['Blob contents']),
        },
        expectedUrl: 'https://example.com',
        expectedOptions: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          body: 'Blob contents',
        },
      },
    ],
    [
      {
        input: 'https://example.com',
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
          // Unsupported body type
          body: 123,
        },
        expectedUrl: 'https://example.com',
        expectedOptions: {
          method: 'PUT',
          headers: { 'content-type': 'application/xml' },
        },
      },
    ],
    // TODO: Test FormData body
    // TODO: Test ReadableStream body
  ])(
    'Test parsing fetch command arguments: %p',
    async ({ input, init, expectedUrl, expectedOptions }) => {
      // @ts-ignore
      const { url, options } = await FetchInstrumentation.parseRequestArguments({ input, init });
      expect(url).toEqual(expectedUrl);
      expect(options).toEqual(expectedOptions);
    }
  );
});
