import * as logger from '../logger';
import { safeExecute } from '../utils';
import { onFailedHook, onStartedHook, onSucceededHook } from './mongodb3x';

export const beforeConstructorHook = (args, extenderContext) => {
  /*
   * Inject the `monitorCommands: true` property in the options (2nd argument).
   * If no options argument is given, well... now there is :D
   */
  switch (args.length) {
    case 0:
      /*
       * Wait this is not possible. It is supposed to have at least the URL
       * as first arg!
       */
      logger.debug(
        'MongoDB 4.x instrumentation skipped: missing expected arguments to MongoClient constructor'
      );
      break;
    case 1:
      args.push({
        monitorCommands: true,
      });
      break;
    default:
      switch (typeof args[1]) {
        case 'object':
          // TODO Check for `null`, which has type object?
          args[1].monitorCommands = true;
          break;
        case 'undefined':
          args[1] = {
            monitorCommands: true,
          };
          break;
        default:
          logger.debug(
            `MongoDB 4.x instrumentation skipped: unexpected type of the 'options' argument: ${typeof optionsObject}`
          );
      }
  }
};

export const afterConstructorHook = (args, clientInstance, extenderContext) => {
  /*
   * Turn on the command listener. This assumes the `monitorCommands` flag we
   * add in the 'beforeConstructor' hook. The shape of the events we get from
   * the MongoDB Client 4.x is the same as those that 3.x emitted with 'instrument'.
   */
  if (args.length > 1 && typeof args[1] === 'object' && args[1].monitorCommands === true) {
    try {
      clientInstance.on('commandStarted', safeExecute(onStartedHook));
      clientInstance.on('commandSucceeded', safeExecute(onSucceededHook));
      clientInstance.on('commandFailed', safeExecute(onFailedHook));
    } catch (err) {
      logger.debug(`MongoDB 4.x 'on' hooks cannot be applied to ${clientInstance}`, err);
    }
  } else {
    logger.debug("MongoDB 4.x 'on' hooks skipped: monitorCommands was not set in the options");
  }
};
