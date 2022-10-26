import * as logger from '../logger';
import { safeExecute } from '../utils';
import { onFailedHook, onStartedHook, onSucceededHook } from './mongodb3x';

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
};

export const beforeConstructorHook = (args: any[], extenderContext: any) => {
  injectMonitoringCommand(args);
};

const isMonitoringEnabled = (args: any[]) => {
  return args.length > 1 && typeof args[1] === 'object' && args[1].monitorCommands === true;
};

export const afterConstructorHook = (args: any[], clientInstance: any, extenderContext: any) => {
  if (isMonitoringEnabled(args)) {
    try {
      clientInstance.on('commandStarted', safeExecute(onStartedHook));
      clientInstance.on('commandSucceeded', safeExecute(onSucceededHook));
      clientInstance.on('commandFailed', safeExecute(onFailedHook));
    } catch (err) {
      logger.warn(`MongoDB 4.x 'on' hooks cannot be applied to ${clientInstance}`, err);
    }
  } else {
    logger.debug("MongoDB 4.x 'on' hooks skipped: monitorCommands was not set in the options");
  }
};
