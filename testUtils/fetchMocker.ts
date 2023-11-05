type MockedResponseType = {
  headers: {
    raw: () => Object;
    get: (key: string) => string;
  };
  json: () => Promise<Object | string>;
  text: () => Promise<string>;
  status: number;
  statusText: string;
  ok: boolean;
};

export const mockFetchGlobal = (options: any) => {
  options = options || {};
  const headers = options['headers'] || {};
  const body = options['body'];
  const status = options['status'] || 200;
  const ok = status >= 200 && status < 300;
  const statusText = options['statusText']
    ? options['statusText']
    : options['body']
    ? options['body']
    : options['status'] == 200
    ? 'OK'
    : '<unknown>';

  // @ts-ignore
  global.fetch = jest.fn(
    (...args): Promise<MockedResponseType> =>
      Promise.resolve({
        headers: {
          raw: () => headers,
          get: (key) => headers[key],
        },
        json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
        text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
        status,
        statusText,
        ok,
      } as MockedResponseType)
  );
};
