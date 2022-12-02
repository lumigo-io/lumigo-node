import mongodb from 'mongo-mock';
import { hook } from '../src/extender';
import { MongoMockerEventEmitter } from './mongodbEventEmitterMocker';

export const wrapMongoCollection = (collection: any, funcName: string, failed: Boolean = false) => {
  hook(collection, funcName, {
    beforeHook: (args: any[]) => {
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

class MongoClient {
  client: any;
  url: string;
  options: any;

  constructor(url: string, options: any) {
    this.client = new mongodb.MongoClient();
    this.url = url;
    this.options = options;
  }

  connect(options: any, callback: Function) {
    const self = this;
    options = options || self.options;
    if (options.connectThrowsError) {
      throw new Error('Connection failed: connectThrowsError');
    }
    return new Promise((resolve, reject) => {
      const promiseCallbackHandler = (err: any, connection: any) => {
        if (connection) {
          connection.on = self.on;
        }
        if (callback) {
          callback(err, connection);
        }
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      };

      try {
        self.client.connect(self.url, options, promiseCallbackHandler);
      } catch (err) {
        reject(err);
      }
    });
  }

  on(event: string, listener: any) {
    if (this.options && this.options.isOnBroken) {
      throw new Error('"on" method is broken');
    }
    MongoMockerEventEmitter.getEventEmitter().on(event, listener);
  }

  static connect(url: string, options: any, callback: Function) {
    if (options.connectThrowsError) {
      throw new Error('Connection failed: connectThrowsError');
    }
    if (!(this && typeof this.prototype === "object")){
      //workaround to check that this scope not been changed
      throw Error("This context has been changed")
    }
    return new Promise(function(resolve, reject) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
          ? options
          : undefined;
      options = typeof options !== 'function' ? options : undefined;
      try {
        const client = new MongoClient(url, options);
        client.connect(null, callback).then(resolve).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const getMockedMongoClientLibrary = () => {
  // extend mongodb so that we can replace its client
  const MongoClientLibrary = () => {};
  MongoClientLibrary.prototype = mongodb;

  // configure the mocked library
  // eslint-disable-next-line camelcase
  MongoClientLibrary.max_delay = 0;
  MongoClientLibrary.MongoClient = MongoClient;

  return MongoClientLibrary;
};
