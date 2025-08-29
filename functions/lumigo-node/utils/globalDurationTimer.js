var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as logger from '../logger';
import { getTracerMaxDurationTimeout, TRACER_TIMEOUT_FLAG } from '../utils';
import { runOneTimeWrapper } from './functionUtils';
const warnTimeoutOnce = runOneTimeWrapper((threshold, currentDuration) => {
    logger.info(`Stopped collecting data for this invocation because it reached the maximum ` +
        `of ${threshold} ms added (added ${currentDuration} ms so far) to the duration of the Lambda. ` +
        `This limit can be modified by setting the ${TRACER_TIMEOUT_FLAG} environment variable`);
}, {});
export const GlobalDurationTimer = (() => {
    let lastStartTime;
    let currentDuration = 0;
    const appendTime = () => {
        if (lastStartTime)
            currentDuration += new Date().getTime() - lastStartTime;
    };
    const start = () => {
        lastStartTime = new Date().getTime();
    };
    const stop = () => {
        appendTime();
        lastStartTime = undefined;
    };
    const reset = () => {
        lastStartTime = undefined;
        currentDuration = 0;
    };
    const isTimePassed = (threshold = undefined) => {
        appendTime();
        threshold = threshold || getTracerMaxDurationTimeout();
        if (currentDuration >= threshold) {
            warnTimeoutOnce(threshold, currentDuration);
            return true;
        }
        return false;
    };
    const timedAsync = () => {
        // eslint-disable-next-line no-undef
        return function (target, propertyKey, descriptor) {
            const originalMethod = descriptor.value;
            descriptor.value = function (...args) {
                return __awaiter(this, void 0, void 0, function* () {
                    start();
                    const result = yield originalMethod.apply(this, args);
                    stop();
                    return result;
                });
            };
            return descriptor;
        };
    };
    const timedSync = () => {
        // eslint-disable-next-line no-undef
        return function (target, propertyKey, descriptor) {
            const originalMethod = descriptor.value;
            descriptor.value = function (...args) {
                start();
                const result = originalMethod.apply(this, args);
                stop();
                return result;
            };
            return descriptor;
        };
    };
    return { timedSync, timedAsync, stop, isTimePassed, start, reset };
})();
