import * as logger from '../logger';
import { safeExecute } from '../utils';
import { onFailedHook, onStartedHook, onSucceededHook } from './mongodb3x';

const attachEventHooks = (client: any) => {
  try {
    client.on('commandStarted', safeExecute(onStartedHook));
    client.on('commandSucceeded', safeExecute(onSucceededHook));
    client.on('commandFailed', safeExecute(onFailedHook));
  } catch (err) {
    logger.warn(`MongoDB 4.x 'on' event hooks cannot be applied to ${client}`, err);
  }
};

const injectMonitoringCommand = (args: any[]) => {
  switch (args.length) {
    case 0:
      logger.warn(
        'MongoDB 4.x instrumentation skipped: missing expected arguments to MongoClient constructor'
      );
      break;
    case 1:
      args.push({
        monitorCommands: true,
      });
      break;
    default:
      const optionsArgumentType: string = typeof args[1];
      switch (optionsArgumentType) {
        case 'object':
          args[1] = args[1] || {}; // typeof returns 'object' for null values
          args[1].monitorCommands = true;
          break;
        case 'undefined':
          args[1] = {
            monitorCommands: true,
          };
          break;
        default:
          logger.warn(
            `MongoDB 4.x instrumentation skipped: unexpected type of the 'options' argument: ${optionsArgumentType}`
          );
      }
  }
  return args;
};

export const wrapMongoClient4xClass = (mongoClientLibrary: any) => {
  const originalPrototype = mongoClientLibrary.MongoClient.prototype;
  const originalConstructor = mongoClientLibrary.MongoClient.prototype.constructor;
  const originalStaticConnect = mongoClientLibrary.MongoClient.connect;
  mongoClientLibrary.MongoClient = function (...args: any[]) {
    const client = new originalConstructor(...injectMonitoringCommand(args));
    attachEventHooks(client);
    return client;
  };
  mongoClientLibrary.MongoClient.prototype = originalPrototype;

  mongoClientLibrary.MongoClient.connect = (url: string, options: any, callback: Function) => {
    return new Promise((resolve, reject) => {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
          ? options
          : undefined;
      options = typeof options !== 'function' ? options : undefined;
      originalStaticConnect(...injectMonitoringCommand([url, options, callback]))
        .then((connection: any) => {
          attachEventHooks(connection);
          resolve(connection);
        })
        .catch(reject);
    });
  };
};
