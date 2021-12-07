import { getEventEntitySize, isEncodingType, safeExecute } from '../utils';

export const isValidHttpRequestBody = (reqBody) =>
  !!(reqBody && (typeof reqBody === 'string' || reqBody instanceof Buffer));

export const extractBodyFromEmitSocketEvent = (socketEventArgs) => {
  return safeExecute(() => {
    if (socketEventArgs && socketEventArgs._httpMessage && socketEventArgs._httpMessage._hasBody) {
      const httpMessage = socketEventArgs._httpMessage;
      let lines = [];
      if (httpMessage.hasOwnProperty('outputData')) {
        lines = httpMessage.outputData[0].data.split('\n');
      } else if (httpMessage.hasOwnProperty('output')) {
        lines = httpMessage.output[0].split('\n');
      }
      if (lines.length > 0) {
        return lines[lines.length - 1];
      }
    }
  })();
};

export const extractBodyFromWriteOrEndFunc = (writeEventArgs) => {
  return safeExecute(() => {
    if (isValidHttpRequestBody(writeEventArgs[0])) {
      const eventEntitySize = getEventEntitySize(true);
      const encoding = isEncodingType(writeEventArgs[1]) ? writeEventArgs[1] : 'utf8';
      let asString = '';
      if (typeof writeEventArgs[0] === 'string') {
        asString = Buffer(writeEventArgs[0]).toString(encoding);
      } else {
        asString = writeEventArgs[0].toString();
      }
      return [asString.substr(0, eventEntitySize), asString.length > eventEntitySize];
    } else {
      return [undefined, false];
    }
  })();
};
