import * as url from 'url';

export const generateHeadersMap = (headers) => {
  if (!headers) return;

  const result = new Map();
  for (const [key, value] of Object.entries(headers)) {
    result.set(key, value);
  }
  return result;
};

type MockedResponseType = {
  headers: Map<string, string>;
  json: () => Promise<Object | string>;
  text: () => Promise<string>;
  status: number;
  statusText: string;
  ok: boolean;
};

export const mockFetchGlobal = (options: any) => {
  options = options || {};
  const headers = options['headers'];
  const body = options['body'];
  const status = options['status'] || 200;
  const ok = status >= 200 && status < 300;
  const statusText = options['statusText'];

  // @ts-ignore
  global.fetch = jest.fn((...args): Promise<MockedResponseType> => {
    // @ts-ignore
    url.parse(args[0]);

    return Promise.resolve({
      headers: generateHeadersMap(headers),
      json: () =>
        new Promise((resolve, reject) => {
          if (typeof body !== 'string') {
            resolve(body);
          } else {
            try {
              const parsedJson = JSON.parse(body);
              resolve(parsedJson);
            } catch (e) {
              reject(e);
            }
          }
        }),
      text: () =>
        new Promise((resolve, reject) => {
          if (typeof body === 'string') {
            resolve(body);
          } else {
            try {
              const stringifiedBody = JSON.stringify(body);
              resolve(stringifiedBody);
            } catch (e) {
              reject(e);
            }
          }
        }),
      status,
      statusText,
      ok,
    } as MockedResponseType);
  });
};
