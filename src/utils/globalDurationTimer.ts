import * as logger from '../logger';
import { getTracerMaxDurationTimeout, TRACER_TIMEOUT_FLAG } from '../utils';
import { runOneTimeWrapper } from './functionUtils';

const warnTimeoutOnce = runOneTimeWrapper((threshold: number, currentDuration: number) => {
  logger.info(
    `Lumigo tracer is no longer collecting data on the invocation, because it reached the maximum 
    of ${threshold} MS added (added ${currentDuration} MS so far) to the lambda duration. 
    This limit can be modified by setting the ${TRACER_TIMEOUT_FLAG} environment variable`
  );
}, {});

export const GlobalDurationTimer = (() => {
  let lastStartTime: number | undefined;
  let currentDuration = 0;

  const appendTime = () => {
    if (lastStartTime) currentDuration += new Date().getTime() - lastStartTime;
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

  const isTimePassed = (threshold: undefined | number = undefined) => {
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
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        start();
        const result = await originalMethod.apply(this, args);
        stop();
        return result;
      };

      return descriptor;
    };
  };

  const timedSync = () => {
    // eslint-disable-next-line no-undef
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      descriptor.value = function (...args: any[]) {
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
