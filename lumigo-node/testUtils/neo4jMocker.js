export const createMockedResponse = (query, params) => {
  return {
    records: [
      {
        keys: ['u'],
        length: 1,
        _fields: [
          {
            identity: {
              low: 0,
              high: 0,
            },
            labels: ['User'],
            properties: {
              id: '2fce6d1c-b060-4e3c-860a-9d6b3f01504f',
              lastName: 'Doe',
              firstName: 'John',
              email: 'j.doe@example.com',
            },
          },
        ],
        _fieldLookup: {
          u: 0,
        },
      },
    ],
    summary: {
      query: {
        text: query,
        parameters: params,
      },
      queryType: 'r',
      counters: {
        _stats: {
          nodesCreated: 0,
          nodesDeleted: 0,
          relationshipsCreated: 0,
          relationshipsDeleted: 0,
          propertiesSet: 0,
          labelsAdded: 0,
          labelsRemoved: 0,
          indexesAdded: 0,
          indexesRemoved: 0,
          constraintsAdded: 0,
          constraintsRemoved: 0,
        },
        _systemUpdates: 0,
      },
      updateStatistics: {
        _stats: {
          nodesCreated: 0,
          nodesDeleted: 0,
          relationshipsCreated: 0,
          relationshipsDeleted: 0,
          propertiesSet: 0,
          labelsAdded: 0,
          labelsRemoved: 0,
          indexesAdded: 0,
          indexesRemoved: 0,
          constraintsAdded: 0,
          constraintsRemoved: 0,
        },
        _systemUpdates: 0,
      },
      plan: false,
      profile: false,
      notifications: [],
      server: {
        address: 'localhost:7687',
        version: 'Neo4j/4.1.4',
      },
      database: {
        name: 'neo4j',
      },
    },
  };
};

export const createMockedClient = (mockedOptions = {}) => {
  const { error, response } = mockedOptions;

  const Session = function(mode, connectionProvider, bookmark, database) {
    this._mode = mode;
    this._connectionHolderWithMode = () => {
      return {
        _database: database,
        _connectionProvider: connectionProvider,
      };
    };
    return this;
  };

  const runQuery = function() {
    return new Promise((resolve, reject) => {
      if (error) {
        reject(error);
      }

      resolve(response);
    });
  };

  Session.prototype.run = runQuery;

  return Session;
};
