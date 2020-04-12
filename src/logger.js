import { TracerGlobals } from './globals';
import { isStoreLogs } from './utils';
const LOG_PREFIX = '#LUMIGO#';
const WARN_CLIENT_PREFIX = 'Lumigo Warning';

const MAX_DUPLICATE_LOGS = 50;

export const LogStore = (() => {
  let logSet = new Set([]);
  let duplicateLogsCount = 0;

  const addLog = (type, message, object) => {
    const logObj = JSON.stringify({ type, message, object });
    if (!logSet.has(logObj)) {
      logSet.add(logObj);
    } else {
      duplicateLogsCount++;
    }
    isEmergencyMode() && printLogs();
  };

  const printLogs = () => {
    logSet.forEach(logObj => {
      const { message, obj } = JSON.parse(logObj);
      forceLog('FATAL', message, obj);
    });
    logSet.clear();
  };

  const isEmergencyMode = () => duplicateLogsCount >= MAX_DUPLICATE_LOGS;
  const clean = () => {
    logSet = new Set([]);
    duplicateLogsCount = 0;
  };
  return { addLog, clean };
})();

export const isDebug = () => {
  let tracerInputs = TracerGlobals.getTracerInputs();
  return tracerInputs.debug;
};

const invokeLog = type => (msg, obj = undefined) => log(type, msg, obj);

export const info = invokeLog('INFO');

export const warn = invokeLog('WARNING');

export const fatal = invokeLog('FATAL');

export const debug = invokeLog('DEBUG');

const log = (levelname, message, obj) => {
  const storeLogsIsOn = isStoreLogs();
  storeLogsIsOn && LogStore.addLog(levelname, message, obj);
  if (exports.isDebug() && !storeLogsIsOn) {
    forceLog(levelname, message, obj);
  }
};

const forceLog = (levelname, message, obj) => {
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
