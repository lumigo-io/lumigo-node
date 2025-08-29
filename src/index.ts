const { trace, Tracer, TracerOptions } = require('./tracer');
const {
  isSwitchedOff,
  safeExecute,
  setSwitchOff,
  setVerboseMode,
  isValidToken,
  SWITCH_OFF_FLAG,
} = require('./utils');
const { ExecutionTags } = require('./globals');
const startHooks = require('./hooks');
const { HttpSpansAgent } = require('./httpSpansAgent');
const logger = require('./logger');
const LumigoLogger = require('./lumigoLogger');

logger.debug('Tracer imported');

const defaultOptions: Partial<TracerOptions> = {
  switchOff: false,
  stepFunction: false,
  debug: false,
};

function initTracer(options: Partial<TracerOptions> = {}): Tracer {
  const traceOptions = { ...defaultOptions, ...options };
  traceOptions.verbose && setVerboseMode();
  traceOptions.switchOff && setSwitchOff();

  const token = assertValidToken(traceOptions.token || process.env.LUMIGO_TRACER_TOKEN);

  if (!traceOptions.switchOff && !isSwitchedOff()) {
    safeExecute(startHooks)();
    logger.debug('Hooks started');
  }

  if (traceOptions.stepFunction) {
    logger.debug('Step function mode enabled');
  }

  return new Tracer(traceOptions);
}

function assertValidToken(token: string): string {
  if (!token) {
    throw new Error('LUMIGO_TRACER_TOKEN environment variable is required');
  }

  if (!isValidToken(token)) {
    throw new Error('Invalid LUMIGO_TRACER_TOKEN');
  }

  return token;
}

// Export the functions
module.exports = {
  trace,
  Tracer,
  TracerOptions,
  initTracer,
  isSwitchedOff,
  setSwitchOff,
  setVerboseMode,
  SWITCH_OFF_FLAG,
  ExecutionTags,
  HttpSpansAgent,
  logger,
  LumigoLogger
};
