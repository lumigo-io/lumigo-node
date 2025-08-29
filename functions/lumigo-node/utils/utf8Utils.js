import { decode } from 'utf8';
import { safeExecute } from '../utils';
import { LOG_LEVELS } from '../logger';
export class Utf8Utils {
    static safeDecode(content) {
        return safeExecute(decode, 'Content is not in utf8', LOG_LEVELS.INFO, content)(content);
    }
}
