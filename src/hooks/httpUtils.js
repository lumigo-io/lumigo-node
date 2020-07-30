import { getEventEntitySize, isEncodingType, safeExecute } from '../utils';
import { prune } from '../utils/payloadStringify';

export const isValidHttpRequestBody = reqBody =>
  !!(reqBody && (typeof reqBody === 'string' || reqBody instanceof Buffer));

export const extractBodyFromEmitSocketEvent = socketEventArgs => {
  return safeExecute(() => {
    const eventSize = getEventEntitySize();
    if (socketEventArgs && socketEventArgs._httpMessage && socketEventArgs._httpMessage._hasBody) {
      const httpMessage = socketEventArgs._httpMessage;
      let lines = [];
      if (httpMessage.hasOwnProperty('outputData')) {
        lines = httpMessage.outputData[0].data.split('\n');
      } else if (httpMessage.hasOwnProperty('output')) {
        lines = httpMessage.output[0].split('\n');
      }
      if (lines.length > 0) {
        const body = lines[lines.length - 1];
        if (body.length > eventSize) return prune(body, eventSize);
        return body;
      }
    }
  })();
};

export const extractBodyFromWriteFunc = writeEventArgs => {
  return safeExecute(() => {
    const eventSize = getEventEntitySize();
    if (isValidHttpRequestBody(writeEventArgs[0])) {
      const encoding = isEncodingType(writeEventArgs[1]) ? writeEventArgs[1] : 'utf8';
      const body =
        typeof writeEventArgs[0] === 'string'
          ? Buffer(writeEventArgs[0]).toString(encoding)
          : writeEventArgs[0].toString();
      if (body.length > eventSize) return prune(body, eventSize);
      return body;
    }
  })();
};

export const extractBodyFromEndFunc = endFuncArgs => {
  return safeExecute(() => {
    const eventSize = getEventEntitySize();
    if (isValidHttpRequestBody(endFuncArgs[0])) {
      if (endFuncArgs[0].length > eventSize) return prune(endFuncArgs[0], eventSize);
      return endFuncArgs[0];
    }
  })();
};
