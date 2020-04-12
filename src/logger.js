import { TracerGlobals } from './globals';

const LOG_PREFIX = '#LUMIGO#';
const WARN_CLIENT_PREFIX = 'Lumigo Warning';

export const isDebug = () => {
  let tracerInputs = TracerGlobals.getTracerInputs();
  return tracerInputs.debug;
};

const invokeLog = type => (msg, obj = undefined) =>
  exports.isDebug() && log(type, msg, obj);

export const info = invokeLog('INFO');

export const warn = invokeLog('WARNING');

export const fatal = invokeLog('FATAL');

export const debug = invokeLog('DEBUG');

const log = (levelname, message, obj) => {
  const escapedMessage = JSON.stringify(message, null, 0);
  const logMsg = `${LOG_PREFIX} - ${levelname} - ${escapedMessage}`;
  if (obj) {
    const escapedObject = JSON.stringify(obj, null, 0);
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
