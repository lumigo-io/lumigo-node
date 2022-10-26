import { hook } from '../extender';
import * as logger from '../logger';
import { safeExecute } from '../utils';
import { safeRequire } from '../utils/requireUtils';
import { onFailedHook, onStartedHook, onSucceededHook } from './mongodb3x';
import { afterConstructorHook, beforeConstructorHook } from './mongodb4x';

export const hookMongoDb = (mongoClientLibrary: any) => {
  const mongoClientLibraries = mongoClientLibrary ? mongoClientLibrary : safeRequire('mongodb');
  const mongooseClients = safeRequire('node_modules/mongoose/node_modules/mongodb');
  const mongoClients = [mongoClientLibraries, mongooseClients].filter(Boolean);

  if (mongoClients.length === 0) {
    logger.debug('MongoDB clients not found');
    return;
  }

  const getVersion = (clientLibrary: any): string => {
    if (clientLibrary.instrument) {
      return '3.x';
    }
    if (
      clientLibrary.MongoClient &&
      clientLibrary.MongoClient.prototype &&
      clientLibrary.MongoClient.prototype.on
    ) {
      return '4.x';
    }
    return 'unknown';
  };

  mongoClients.forEach((mongoClientLibrary) => {
    switch (getVersion(mongoClientLibrary)) {
      case '3.x':
        const listener = mongoClientLibrary.instrument({}, (err: any) => {
          if (err) {
            logger.warn('MongoDB 3.x instrumentation failed ', err);
          }
        });

        const safeStartedHook: Function = safeExecute(onStartedHook);
        const safeSucceededHook: Function = safeExecute(onSucceededHook);
        const safeFailedHook: Function = safeExecute(onFailedHook);

        safeExecute(() => {
          listener.on('started', safeStartedHook);
          listener.on('succeeded', safeSucceededHook);
          listener.on('failed', safeFailedHook);
        })();

        logger.debug('MongoDB 3.x instrumentation applied');
        break;
      case '4.x':
        hook(mongoClientLibrary, 'MongoClient', {
          isConstructor: true,
          beforeHook: beforeConstructorHook,
          afterHook: afterConstructorHook,
        });

        logger.debug('MongoDB 4.x instrumentation applied');
        break;
      default:
        logger.warn('MongoDB instrumentation skipped: unsupported client version');
    }
  });
};
