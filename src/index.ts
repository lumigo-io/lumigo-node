import { trace, Tracer, TracerOptions } from './tracer';
import { safeExecute, setSwitchOff, setVerboseMode, isValidToken } from './utils';
import * as LumigoLogger from './lumigoLogger';
import { debug } from './logger';
import { ExecutionTags } from './globals';
import startHooks from './hooks';
import { HttpSpansAgent } from './httpSpansAgent';
import * as logger from './logger';

debug('Tracer imported');

const defaultOptions: Partial<TracerOptions> = {
  switchOff: false,
  stepFunction: false,
  debug: false,
  eventFilter: {},
};

function initTracer(options?: TracerOptions): Tracer {
  const traceOptions = {
    ...defaultOptions,
    ...options,
  };

  traceOptions?.verbose && setVerboseMode();
  traceOptions?.switchOff && setSwitchOff();

  const token = assertValidToken(traceOptions.token || process.env.LUMIGO_TRACER_TOKEN);

  safeExecute(startHooks)();
  HttpSpansAgent.initAgent();

  return {
    trace: trace({ ...traceOptions, token }),
    addExecutionTag: ExecutionTags.addTag,
    info: LumigoLogger.info,
    warn: LumigoLogger.warn,
    error: LumigoLogger.error,
  };
}

const assertValidToken = <LumigoToken = string | null>(token: LumigoToken): LumigoToken => {
  if (!isValidToken(token)) {
    logger.warnClient(`Invalid Token. Go to Lumigo Settings to get a valid token.`);
    setSwitchOff();
    return null;
  }

  return token;
};

module.exports = initTracer;
Object.assign(module.exports, {
  addExecutionTag: ExecutionTags.addTag,
  info: LumigoLogger.info,
  warn: LumigoLogger.warn,
  error: LumigoLogger.error,
  initTracer,
});
