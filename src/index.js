import { trace } from './tracer';
import { safeExecute, setSwitchOff, setVerboseMode } from './utils';
import { debug } from './logger';
import { ExecutionTags } from './globals';
import startHooks from './hooks';

debug('Tracer imported');

module.exports = function({
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
  };
};

Object.assign(module.exports, { addExecutionTag: ExecutionTags.addTag });
