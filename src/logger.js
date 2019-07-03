import { isDebug } from './utils';

const LOG_PREFIX = '#LUMIGO#';
const Console = console;

export const info = obj => {
  log('INFO', obj);
};

export const debug = obj => {
  isDebug() && log('DEBUG', obj);
};

export const warn = obj => {
  log('WARNING', obj);
};

export const fatal = obj => {
  log('FATAL', obj);
};

const log = (levelname, message) => {
  const escapedMessage = JSON.stringify(message, null, 2);
  const logMsg = `${LOG_PREFIX} - ${levelname} - ${escapedMessage}`;
  Console.log(logMsg);
};
