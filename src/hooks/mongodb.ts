import * as logger from '../logger';
import { safeRequire } from '../utils/requireUtils';
import { configureMongoClient3xInstrumentation } from './mongodb3x';
import { wrapMongoClient4xClass } from './mongodb4x';

export const hookMongoDb = (mongoClientLibrary: any | null = null) => {
  const mongoClientLibraries = mongoClientLibrary ? mongoClientLibrary : safeRequire('mongodb');
  const mongooseClients = safeRequire('node_modules/mongoose/node_modules/mongodb');
  const mongoClients = [mongoClientLibraries, mongooseClients].filter(Boolean);

  if (mongoClients.length === 0) {
    logger.debug('MongoDB clients not found');
    return;
  }

  const getVersion = (clientLibrary: any): string => {
    if (typeof clientLibrary.instrument === 'function') {
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
        configureMongoClient3xInstrumentation(mongoClientLibrary);
        logger.debug('MongoDB 3.x instrumentation applied');
        break;

      case '4.x':
        wrapMongoClient4xClass(mongoClientLibrary);
        logger.debug('MongoDB 4.x instrumentation applied');
        break;

      default:
        logger.warn('MongoDB instrumentation skipped: unsupported client version');
    }
  });
};
