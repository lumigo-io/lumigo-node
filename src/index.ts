import { trace, Tracer, TracerOptions } from './tracer';
import { safeExecute, setSwitchOff, setVerboseMode, isValidToken } from './utils';
import { ExecutionTags } from './globals';
import startHooks from './hooks';
import { HttpSpansAgent } from './httpSpansAgent';
import * as logger from './logger';
import * as LumigoLogger from './lumigoLogger';

logger.debug('Tracer imported');

const defaultOptions: Partial<TracerOptions> = {
  switchOff: false,
  stepFunction: false,
  debug: false,
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

// for index.d.ts to be generated properly
export { info, warn, error } from './lumigoLogger';
export default initTracer;
export const addExecutionTag = ExecutionTags.addTag;
export { initTracer };
export type { Tracer, TracerOptions };

// for backward compatibility
module.exports = initTracer;
Object.assign(module.exports, {
  addExecutionTag,
  info: LumigoLogger.info,
  warn: LumigoLogger.warn,
  error: LumigoLogger.error,
  initTracer,
});
