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
const createMockClientWithOptions = (mockedOptions) => {
  const { error, rowCount, activeQuery, queryQueue } = mockedOptions;
  const Client = function (options = {}) {
    this.connectionParameters = options;
    this.activeQuery = activeQuery;
    this.queryQueue = queryQueue;
    return this;
  };
  Client.prototype.query = function (...args) {
    // query (text: string) => Promise
    // query (text: string, values: Array<mixed>) => Promise
    if (!args[1] || (Array.isArray(args[1]) && !args[2]))
      return new Promise((resolve, reject) => {
        error && reject(error);
        resolve(createMockedResponse(rowCount));
      });
    // query (text: string, values: Array<mixed>, callback: Function) => void
    if (args[2] && typeof args[2] === 'function') {
      if (this.queryQueue) {
        this.queryQueue[0] = { callback: args[2] };
      } else {
        this.activeQuery.callback = args[2];
      }
      setTimeout(() => {
        let activeQuery = this.activeQuery ? this.activeQuery : this.queryQueue[0];
        error && activeQuery.callback(error, null);
        !error && activeQuery.callback(null, createMockedResponse(rowCount));
      }, 20);
      return undefined;
    }
    // query (text: string, callback: Function) => void
    if (args[1] && typeof args[1] === 'function') {
      if (this.queryQueue) {
        this.queryQueue[0] = { callback: args[1] };
      } else {
        this.activeQuery.callback = args[1];
      }
      setTimeout(() => {
        let activeQuery = this.activeQuery ? this.activeQuery : this.queryQueue[0];
        error && activeQuery.callback(error, null);
        !error && activeQuery.callback(null, createMockedResponse(rowCount));
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
