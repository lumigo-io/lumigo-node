import { isDebug } from './utils';

const LOG_PREFIX = '#LUMIGO#';
const Console = console;

export const info = (msg, obj = undefined) => {
  log('INFO', msg, obj);
};

export const debug = (msg, obj = undefined) => {
  isDebug() && log('DEBUG', msg, obj);
};

export const warn = (msg, obj = undefined) => {
  log('WARNING', msg, obj);
};

export const fatal = (msg, obj = undefined) => {
  log('FATAL', msg, obj);
};

const log = (levelname, message, obj) => {
  const escapedMessage = JSON.stringify(message, null, 2);
  const logMsg = `${LOG_PREFIX} - ${levelname} - ${escapedMessage}`;
  if (obj) {
    const escapedObject = JSON.stringify(obj, null, 2);
    Console.log(logMsg, escapedObject);
  } else {
    Console.log(logMsg);
  }
};
