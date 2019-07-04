import { isDebug } from './utils';

const LOG_PREFIX = '#LUMIGO#';

export const invokeLog = type => (msg, obj = undefined) =>
  isDebug() && exports.log(type, msg, obj);

export const info = invokeLog('INFO');

export const warn = invokeLog('WARNING');

export const fatal = invokeLog('FATAL');

export const debug = invokeLog('DEBUG');

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
