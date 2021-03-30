import { isDebug, isStoreLogs } from './utils';
const LOG_PREFIX = '#LUMIGO#';
const WARN_CLIENT_PREFIX = 'Lumigo Warning';

const MAX_DUPLICATE_LOGS = 50;

export const LOG_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  FATAL: 'FATAL',
  DEBUG: 'DEBUG',
};

export const LogStore = (() => {
  let logSet = new Set([]);
  let duplicateLogsCount = 0;

  const addLog = (type: string, message: string, object: object | undefined): void => {
    const logObj = JSON.stringify({ type, message, object });
    if (!logSet.has(logObj)) {
      logSet.add(logObj);
    } else {
      duplicateLogsCount++;
    }
    isEmergencyMode() && printLogs();
  };

  const printLogs = ():void => {
    logSet.forEach(logObj => {
      const { message, obj } = JSON.parse(logObj);
      forceLog('FATAL', message, obj);
    });
    logSet.clear();
  };

  const isEmergencyMode = ():boolean => duplicateLogsCount >= MAX_DUPLICATE_LOGS;

  const clean = (): void => {
    logSet = new Set([]);
    duplicateLogsCount = 0;
  };
  return { addLog, clean };
})();

const invokeLog = (type: string) => (msg: string, obj: object | undefined = undefined) => log(type, msg, obj);

export const info = invokeLog('INFO');

export const warn = invokeLog('WARNING');

export const fatal = invokeLog('FATAL');

export const debug = invokeLog('DEBUG');

export const log = (levelname: string, message: string, obj: object | undefined): void => {
  const storeLogsIsOn = isStoreLogs();
  storeLogsIsOn && LogStore.addLog(levelname, message, obj);
  if (isDebug() && !storeLogsIsOn) {
    forceLog(levelname, message, obj);
  }
};

const forceLog = (levelname: string, message: string, obj: object | undefined): void => {
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

export const warnClient = (msg: string, obj: object | undefined = undefined): boolean => {
  if (process.env.LUMIGO_WARNINGS === 'off') {
    debug(`Does not warn the user about - ${msg}`);
    return false;
  }
  if (obj)
    // eslint-disable-next-line no-console
    console.log(`${WARN_CLIENT_PREFIX}: ${msg}`, obj);
  // eslint-disable-next-line no-console
  else console.log(`${WARN_CLIENT_PREFIX}: ${msg}`);
  return true;
};
