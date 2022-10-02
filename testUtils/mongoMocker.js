import EventEmitter from 'events';
import mongodb from 'mongo-mock';
import { hook } from '../src/extender';

export const MongoMockerEventEmitter = (() => {
  let eventEmitter = new EventEmitter();
  const getEventEmitter = () => eventEmitter;
  const cleanEventEmitter = () => {
    eventEmitter.eventNames().forEach((event) => {
      eventEmitter.removeAllListeners(event);
    });
  };
  return { getEventEmitter, cleanEventEmitter };
})();

export const wrapMongoCollection = (collection, funcName, failed = false) => {
  hook(collection, funcName, {
    beforeHook: (args) => {
      MongoMockerEventEmitter.getEventEmitter().emit('started', {
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
        MongoMockerEventEmitter.getEventEmitter().emit('failed', {
          duration: 26,
          failure: 'Wow What a error',
          commandName: funcName,
          requestId: 13,
          operationId: undefined,
          connectionId: 1,
        });
      } else {
        MongoMockerEventEmitter.getEventEmitter().emit('succeeded', {
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

export const getMockedMongoClient = (options = {}) => {
  const MongoClient = mongodb.MongoClient;
  // eslint-disable-next-line camelcase
  mongodb.max_delay = 0;
  if (options.instrumentFailed) {
    mongodb.instrument = (options, errCallback) => {
      errCallback('RandomError');
    };
  } else {
    mongodb.instrument = () => MongoMockerEventEmitter.getEventEmitter();
  }

  return { mongoLib: mongodb, mongoClient: MongoClient };
};

export const promisifyMongoFunc =
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
