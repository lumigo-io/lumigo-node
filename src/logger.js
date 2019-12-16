import { TracerGlobals } from './globals';

const LOG_PREFIX = '#LUMIGO#';
const WARN_CLIENT_PREFIX = 'Lumigo Warning';

export const isDebug = () => {
  let tracerInputs = TracerGlobals.getTracerInputs();
  return tracerInputs.debug;
};

export const invokeLog = type => (msg, obj = undefined) =>
  exports.isDebug() && exports.log(type, msg, obj);

export const info = exports.invokeLog('INFO');

export const warn = exports.invokeLog('WARNING');

export const fatal = exports.invokeLog('FATAL');

export const debug = exports.invokeLog('DEBUG');

export const log = (levelname, message, obj) => {
  const escapedMessage = JSON.stringify(message, null, 2);
  const logMsg = `${LOG_PREFIX} - ${levelname} - ${escapedMessage}`;
  if (obj) {
    const escapedObject = JSON.stringify(obj, null, 2);
    // eslint-disable-next-line
    console.log(logMsg, escapedObject);
  } else {
    // eslint-disable-next-line
    console.log(logMsg);
  }
};

export const warnClient = msg => {
  if (process.env.LUMIGO_WARNINGS === 'off') {
    debug('Does not warn the user about', msg);
    return false;
  }
  // eslint-disable-next-line no-console
  console.log(`${WARN_CLIENT_PREFIX}: ${msg}`);
  return true;
};
