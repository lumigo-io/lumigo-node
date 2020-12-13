const DUMMY_ROW = { name: 'LumigoDevMan', dummyNumber: 6 };

export const createMockedResponse = (rowCount = 5) => {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({ ...DUMMY_ROW });
  }
  return {
    recordset: rows,
    rowsAffected: rowCount,
  };
};
export const createMockedClient = mockedOptions => {
  class Request {
    query(...args) {
      // query (text: string) => Promise
      if (!args[1])
        return new Promise((resolve, reject) => {
          error && reject(error);
          resolve(createMockedResponse(rowCount));
        });
      // query (text: string, callback: Function) => void
      if (args[1] && typeof args[1] === 'function') {
        setTimeout(() => {
          error && args[1](error, null);
          !error && args[1](null, createMockedResponse(rowCount));
        }, 20);
        return undefined;
      }
    }
  }
  const { error, rowCount } = mockedOptions;
  return {
    query: (...args) => new Request().query(...args),
    connect: () => {},
    Request,
  };
};
