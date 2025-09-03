import * as shimmer from 'shimmer';
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

const getStaticProperties = (nodule: any) => {
  const baseProperties = ['prototype', 'name', 'length'];
  return Object.getOwnPropertyNames(nodule).filter((x) => !baseProperties.includes(x));
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
  try {
    const originalStaticConnect = mongoClientLibrary.MongoClient.connect;
    const staticProperties = getStaticProperties(mongoClientLibrary.MongoClient);
    const wrapper = (originalFn: any) => {
      const wrappedClass = function (...args: any[]) {
        const client = new originalFn(...injectMonitoringCommand(args));
        attachEventHooks(client);
        return client;
      };
      // ensure that we don't lose any unexpected static properties
      for (const key of staticProperties) {
        wrappedClass[key] = originalFn[key];
      }
      // wrap the original connect method. this references the original constructor
      // and not our overridden one, so we must attach the hooks to the resulting
      // client instance
      wrappedClass.connect = function (url: string, options: any, callback: Function) {
        return new Promise((resolve, reject) => {
          try {
            callback =
              typeof callback === 'function'
                ? callback
                : typeof options === 'function'
                ? options
                : undefined;
            options = typeof options !== 'function' ? options : undefined;
            originalStaticConnect
              .bind(this)(...injectMonitoringCommand([url, options, callback]))
              .then((client: any) => {
                attachEventHooks(client);
                resolve(client);
              })
              .catch(reject);
          } catch (err) {
            reject(err);
          }
        });
      };
      return wrappedClass;
    };
    shimmer.wrap(mongoClientLibrary, 'MongoClient', wrapper);
  } catch (err) {
    logger.warn('MongoDB 4.x instrumentation skipped: failed to wrap MongoClient class', err);
  }
};
