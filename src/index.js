import { trace } from './tracer';
import { setSwitchOff, setVerboseMode } from './utils';
import { debug } from './logger';
import { ExecutionTags } from './globals';

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
