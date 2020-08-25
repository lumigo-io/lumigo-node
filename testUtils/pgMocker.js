const DUMMY_ROW = { name: 'LumigoDevMan', dummyNumber: 6 };

export const createMockedResponse = (rowCount = 5) => {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({ ...DUMMY_ROW });
  }
  return {
    command: 'SELECT',
    rowCount: rowCount,
    oid: null,
    rows: rows,
    fields: [],
    _parsers: [],
    _types: [],
    RowCtor: null,
    rowAsArray: false,
  };
};
const createMockClientWithOptions = mockedOptions => {
  const { error, rowCount } = mockedOptions;
  const Client = function Client(options = {}) {
    this.connectionParameters = options;
    this.activeQuery = {};
    return this;
  };
  Client.prototype.query = function(...args) {
    // query (text: string) => Promise
    // query (text: string, values: Array<mixed>) => Promise
    if (!args[1] || (Array.isArray(args[1]) && !args[2]))
      return new Promise((resolve, reject) => {
        error && reject(error);
        resolve(createMockedResponse(rowCount));
      });
    // query (text: string, values: Array<mixed>, callback: Function) => void
    if (args[2] && typeof args[2] === 'function') {
      this.activeQuery.callback = args[2];
      setTimeout(() => {
        error && this.activeQuery.callback(error, null);
        !error && this.activeQuery.callback(null, createMockedResponse(rowCount));
      }, 20);
      return undefined;
    }
    // query (text: string, callback: Function) => void
    if (args[1] && typeof args[1] === 'function') {
      this.activeQuery.callback = args[1];
      setTimeout(() => {
        error && this.activeQuery.callback(error, null);
        !error && this.activeQuery.callback(null, createMockedResponse(rowCount));
      }, 20);
      return undefined;
    }
  };
  return Client;
};

export const createMockedClient = (mockOptions = {}) => {
  const pgClient = createMockClientWithOptions(mockOptions);
  return {
    Client: pgClient,
  };
};
