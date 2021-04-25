import { trace } from './tracer';
import { safeExecute, setSwitchOff, setVerboseMode } from './utils';
import * as LumigoLogger from './lumigoLogger';
import { debug } from './logger';
import { ExecutionTags } from './globals';
import startHooks from './hooks';
import { HttpSpansAgent } from './httpSpansAgent';

debug('Tracer imported');

module.exports = function ({
  token,
  debug = false,
  edgeHost,
  eventFilter = {},
  verbose = false,
  switchOff = false,
  stepFunction = false,
}) {
  verbose && setVerboseMode();
  switchOff && setSwitchOff();
  safeExecute(startHooks)();
  HttpSpansAgent.initAgent();

  return {
    trace: trace({
      token,
      debug,
      edgeHost,
      switchOff,
      eventFilter,
      stepFunction,
    }),
    addExecutionTag: ExecutionTags.addTag,
    info: LumigoLogger.info,
    warn: LumigoLogger.warn,
    error: LumigoLogger.error,
  };
};

Object.assign(module.exports, { addExecutionTag: ExecutionTags.addTag });
