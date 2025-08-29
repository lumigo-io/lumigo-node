import { isEncodingType, safeExecute } from '../utils';
import { TextDecoder } from 'util';
export const isValidHttpRequestBody = (reqBody) => !!(reqBody && (typeof reqBody === 'string' || reqBody instanceof Buffer));
export const extractBodyFromEmitSocketEvent = (socketEventArgs) => {
    return safeExecute(() => {
        if (socketEventArgs && socketEventArgs._httpMessage && socketEventArgs._httpMessage._hasBody) {
            const httpMessage = socketEventArgs._httpMessage;
            let lines = [];
            if (httpMessage.hasOwnProperty('outputData')) {
                lines = httpMessage.outputData[0].data.split('\n');
            }
            else if (httpMessage.hasOwnProperty('output')) {
                lines = httpMessage.output[0].split('\n');
            }
            if (lines.length > 0) {
                return lines[lines.length - 1];
            }
        }
    })();
};
export const httpDataToString = (data) => {
    if (Buffer.isBuffer(data)) {
        try {
            return new TextDecoder('utf8', { fatal: true }).decode(data);
        }
        catch (e) {
            return data.toString('hex');
        }
    }
    else {
        return data.toString();
    }
};
export const extractBodyFromWriteOrEndFunc = (writeEventArgs) => {
    /**
     * Extract the body from the given arguments list, where the arguments are:
     * 0 - The request body, as a string, Buffer or any other type that can be converted to a string using toString().
     * 1 - The encoding of the request body (example values: 'ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex').
     *     If the value is missing / unknown the default value is 'utf8'.
     *
     * The input is a list of arguments for legacy reasons
     */
    return safeExecute(() => {
        if (isValidHttpRequestBody(writeEventArgs[0])) {
            const encoding = isEncodingType(writeEventArgs[1]) ? writeEventArgs[1] : 'utf8';
            return typeof writeEventArgs[0] === 'string'
                ? Buffer.from(writeEventArgs[0]).toString(encoding)
                : httpDataToString(writeEventArgs[0]);
        }
    })();
};
