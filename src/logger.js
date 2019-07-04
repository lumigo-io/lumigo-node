import { isDebug } from './utils';

const LOG_PREFIX = '#LUMIGO#';

export const info = (msg, obj = undefined) => exports.log('INFO', msg, obj);

export const warn = (msg, obj = undefined) => exports.log('WARNING', msg, obj);

export const fatal = (msg, obj = undefined) => exports.log('FATAL', msg, obj);

const fn = type => (msg, obj = undefined) => exports.log(type, msg, obj);

export const fata = fn('FATAL');

export const debug = (msg, obj = undefined) =>
  isDebug() && exports.log('DEBUG', msg, obj);

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
