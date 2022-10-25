import { hook } from '../extender';
import * as logger from '../logger';
import { safeExecute } from '../utils';
import { safeRequire } from '../utils/requireUtils';
import { onFailedHook, onStartedHook, onSucceededHook } from './mongodb3x';
import { afterConstructorHook, beforeConstructorHook } from './mongodb4x';

export const hookMongoDb = (mongoClientLibrary) => {
  const mongoClientLibraries = mongoClientLibrary ? mongoClientLibrary : safeRequire('mongodb');
  const mongooseClients = safeRequire('node_modules/mongoose/node_modules/mongodb');
  const mongoClients = [mongoClientLibraries, mongooseClients].filter(Boolean);

  /* istanbul ignore next : there's no point in testing this */
  if (!mongoClients) {
    logger.debug('MongoDB clients not found');
    return;
  }

  mongoClients.forEach((mongoClientLibrary) => {
    let mongoClientVersion = 'unknown';
    if (mongoClientLibrary.instrument) {
      mongoClientVersion = '3.x';
    } else if (mongoClientLibrary.MongoClient.prototype.on) {
      mongoClientVersion = '4.x';
    }
    switch (mongoClientVersion) {
      case '3.x':
        const listener = mongoClientLibrary.instrument({}, (err) => {
          if (err) {
            logger.warn('MongoDB 3.x instrumentation failed ', err);
          }
        });

        const safeStartedHook = safeExecute(onStartedHook);
        const safeSucceededHook = safeExecute(onSucceededHook);
        const safeFailedHook = safeExecute(onFailedHook);

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

        // TODO Find a hook for catching connection issues.

        logger.debug('MongoDB 4.x instrumentation applied');
        break;
      default:
        logger.warn('MongoDB instrumentation skipped: unsupported client version');
    }
  });
};
