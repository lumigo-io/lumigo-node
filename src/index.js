import { trace } from './tracer';
import { safeExecute, setSwitchOff, setSwitchOn, setVerboseMode } from './utils';
import { debug } from './logger';
import { ExecutionTags } from './globals';
import startHooks from './hooks';
import { HttpSpansAgent } from './httpSpansAgent';
import * as logger from './logger';

debug('Tracer imported');

const isValidToken = token => {
  const regex = /[t][_][a-z0-9]{15,100}/gm;
  const match = (token || '').match(regex);
  return match && token === match[0];
};

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

  if (!isValidToken(token)) {
    logger.warnClient('Invalid Token. Go to Lumigo Settings to get a valid token.');
    setSwitchOff();
  } else if(!switchOff){
    setSwitchOn();
  }

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
  };
};

Object.assign(module.exports, { addExecutionTag: ExecutionTags.addTag });
