import mongodb from 'mongo-mock';
import { hook } from '../src/extender';
import { MongoMockerEventEmitter } from './mongodbEventEmitterMocker';

export const wrapMongoCollection = (collection, funcName, failed = false) => {
  hook(collection, funcName, {
    beforeHook: (args) => {
      MongoMockerEventEmitter.getEventEmitter().emit('commandStarted', {
        eventName: 'onStartedHook',
        command: {
          insert: 'documents',
          documents: args[0],
          ordered: true,
          lsid: { id: '2' },
          txnNumber: 1,
          $clusterTime: { clusterTime: 123, signature: { '1': 1 } },
          $db: 'TracerDB',
        },
        databaseName: 'TracerDB',
        commandName: funcName,
        requestId: 13,
        operationId: undefined,
        connectionId: 1,
      });
    },
    afterHook: () => {
      if (failed) {
        MongoMockerEventEmitter.getEventEmitter().emit('commandFailed', {
          duration: 26,
          failure: 'Wow, what an error!',
          commandName: funcName,
          requestId: 13,
          operationId: undefined,
          connectionId: 1,
        });
      } else {
        MongoMockerEventEmitter.getEventEmitter().emit('commandSucceeded', {
          duration: 26,
          reply: {
            n: 1,
            opTime: { ts: 123456, t: 3 },
            electionId: 7,
            ok: 1,
            $clusterTime: { clusterTime: 123456, signature: { sign: '1234' } },
            operationTime: 12345,
          },
          commandName: funcName,
          requestId: 13,
          operationId: undefined,
          connectionId: 1,
        });
      }
    },
  });
};

const promisifyMongoFunc =
  (func) =>
  (...params) =>
    new Promise((resolve, reject) => {
      const promiseCallbackHandler = (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      };

      try {
        func.apply(this, [...params, promiseCallbackHandler]);
      } catch (err) {
        reject(err);
      }
    });

export const getMockedMongoClient = (options = {}) => {
  // extend mongodb so that we can replace its client
  const MongoClientLibrary = () => {};
  MongoClientLibrary.prototype = mongodb;

  // configure the mocked library
  // eslint-disable-next-line camelcase
  MongoClientLibrary.max_delay = 0;
  // TODO can 4x instrumentation fail in a similar way?
  /*if (options.instrumentFailed) {
    MongoClientLibrary.instrument = (options, errCallback) => {
      errCallback('RandomError');
    };
  }*/

  // extend the mocked client and make it an emitter
  const MongoClient = (options) => {
    if (!(this instanceof MongoClient)) return new MongoClient(options);

    // "inherit" event emitter methods
    const eventEmitter = MongoMockerEventEmitter.getEventEmitter();
    for (var methodName in eventEmitter.prototype) {
      this[methodName] = eventEmitter.prototype[methodName];
    }
  };
  MongoClient.prototype = Object.create(mongodb.MongoClient.prototype);

  // promisify the client's functions
  Object.keys(mongodb.MongoClient).forEach((key) => {
    if (typeof mongodb.MongoClient[key] === 'function') {
      MongoClient[key] = promisifyMongoFunc(mongodb.MongoClient[key]);
    }
  });

  MongoClientLibrary.MongoClient = MongoClient;

  return { mongoClientLibrary: MongoClientLibrary, mongoClient: MongoClientLibrary.MongoClient };
};
