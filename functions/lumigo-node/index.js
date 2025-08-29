import { trace } from './tracer';
import { isSwitchedOff, safeExecute, setSwitchOff, setVerboseMode, isValidToken, } from './utils';
import { ExecutionTags } from './globals';
import startHooks from './hooks';
import { HttpSpansAgent } from './httpSpansAgent';
import * as logger from './logger';
import * as LumigoLogger from './lumigoLogger';
logger.debug('Tracer imported');
const defaultOptions = {
    switchOff: false,
    stepFunction: false,
    debug: false,
};
function initTracer(options) {
    const traceOptions = Object.assign(Object.assign({}, defaultOptions), options);
    (traceOptions === null || traceOptions === void 0 ? void 0 : traceOptions.verbose) && setVerboseMode();
    (traceOptions === null || traceOptions === void 0 ? void 0 : traceOptions.switchOff) && setSwitchOff();
    const token = assertValidToken(traceOptions.token || process.env.LUMIGO_TRACER_TOKEN);
    if (!(traceOptions === null || traceOptions === void 0 ? void 0 : traceOptions.switchOff) && !isSwitchedOff()) {
        safeExecute(startHooks)();
        HttpSpansAgent.initAgent();
    }
    return {
        trace: trace(Object.assign(Object.assign({}, traceOptions), { token })),
        addExecutionTag: ExecutionTags.addTag,
        info: LumigoLogger.info,
        warn: LumigoLogger.warn,
        error: LumigoLogger.error,
    };
}
const assertValidToken = (token) => {
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
// for backward compatibility
module.exports = initTracer;
Object.assign(module.exports, {
    addExecutionTag,
    info: LumigoLogger.info,
    warn: LumigoLogger.warn,
    error: LumigoLogger.error,
    initTracer,
});
