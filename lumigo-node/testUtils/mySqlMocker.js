const DUMMY_ROW = { name: 'LumigoDevMan', dummyNumber: 6 };

export const createMockedResponse = (rowCount = 5) => {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({ ...DUMMY_ROW });
  }
  return rows;
};
const createMockClientWithOptions = mockedOptions => {
  const { error, rowCount, mySqlVersion } = mockedOptions;
  const Client = function(options = {}) {
    this.config = options;
    return this;
  };
  const queryFunc = function(...args) {
    const userCallback = typeof args[1] === 'function' ? args[1] : args[2];
    let returnValue = {};
    if (mySqlVersion === '1') {
      returnValue._callback = userCallback;
    } else {
      if (mySqlVersion === '2') {
        returnValue.onResult = userCallback;
      }
    }
    const getFuncBySqlVersion = () =>
      mySqlVersion === '1' ? returnValue._callback : returnValue.onResult;

    // query (text: string, values: Array<mixed>, callback: Function)
    if (args[2] && typeof args[2] === 'function') {
      setTimeout(() => {
        error && getFuncBySqlVersion()(error, null);
        !error && getFuncBySqlVersion()(null, createMockedResponse(rowCount));
      }, 20);
      return returnValue;
    }
    // query (text: string, callback: Function) => void
    if (args[1] && typeof args[1] === 'function') {
      setTimeout(() => {
        error && getFuncBySqlVersion()(error, null);
        !error && getFuncBySqlVersion()(null, createMockedResponse(rowCount));
      }, 20);
      return returnValue;
    }
  };
  Client.prototype.query = queryFunc;
  if (mySqlVersion === '2') Client.prototype.execute = queryFunc;
  return Client;
};

export const createMockedClient = (mockOptions = {}) => {
  const { mySqlVersion } = mockOptions;
  const client = createMockClientWithOptions(mockOptions);
  if (mySqlVersion === '2')
    return {
      Connection: client,
    };
  if (mySqlVersion === '1') {
    client.Connection = {};
    return client;
  }
};
