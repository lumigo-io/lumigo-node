import { isDebug } from './utils';

const LOG_PREFIX = '#LUMIGO#';
const DUPLICATE_LOGS_TO_EMERGENCY_MODE = 10;

const printedLogSet = new Set([]);
const pendingLogSet = new Set([]);
let duplicateLogsCount = 0;

export const invokeLog = type => (msg, obj = undefined) => {
  if (isEmergencyMode() || isDebug()) {
    safePrint(printedLogSet, type, msg, obj);
  } else {
    const logObj = buildLogObject(type, msg, obj);
    addToPendingLogs(pendingLogSet, printedLogSet, logObj);
  }
  if (isEmergencyMode()) {
    printPendingLogs(pendingLogSet, printedLogSet);
  }
};

export const safePrint = (printedLogSet, type, message, obj) => {
  const logObj = buildLogObject(type, message, obj);
  if (!printedLogSet.has(JSON.stringify(logObj))) {
    exports.log(type, message, obj);
    printedLogSet.add(JSON.stringify(logObj));
  } else {
    duplicateLogsCount++;
  }
};

export const printPendingLogs = (pendingLogSet, printedLogSet) => {
  pendingLogSet.forEach(logObj => {
    const { type, message, obj } = JSON.parse(logObj);
    safePrint(printedLogSet, type, message, obj);
  });
  pendingLogSet.clear();
};

export const buildLogObject = (type, message, obj) => ({
  type,
  message,
  obj,
});

export const isEmergencyMode = () =>
  duplicateLogsCount >= DUPLICATE_LOGS_TO_EMERGENCY_MODE;

export const resetLogger = () => {
  duplicateLogsCount = 0;
  printedLogSet.clear();
  pendingLogSet.clear();
};

export const addToPendingLogs = (pendingLogSet, printedLogSet, logObj) => {
  if (
    !printedLogSet.has(JSON.stringify(logObj)) &&
    !pendingLogSet.has(JSON.stringify(logObj))
  ) {
    pendingLogSet.add(JSON.stringify(logObj));
  } else {
    duplicateLogsCount++;
  }
};

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
