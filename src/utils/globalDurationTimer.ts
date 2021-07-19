import * as logger from '../logger';
import { getTracerMaxDurationTimeout } from '../utils';
import { runOneTimeWrapper } from './functionUtils';

const warnTimeoutOnce = runOneTimeWrapper(() => {
  logger.warnClient('Lumigo tracer timed out and is no longer collecting data on the invocation.');
}, {});

export type TimerReport = { name: string; duration: number };

export type TracerTimer = {
  timedSync: Function;
  timedAsync: Function;
  stop: () => void;
  isTimePassed: (time?: number) => boolean;
  start: () => void;
  reset: () => void;
  getReport: () => TimerReport;
};

// eslint-disable-next-line no-undef
export const TracerTimers: Record<string, TracerTimer> = {};

export const getDurationTimer = (name = 'global'): TracerTimer => {
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
      warnTimeoutOnce();
      return true;
    }
    return false;
  };

  const getReport = (): { name: string; duration: number } => {
    return {
      name,
      duration: currentDuration,
    };
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
  const res = { timedSync, timedAsync, stop, isTimePassed, start, reset, getReport };
  TracerTimers[name] = res;
  return res;
};

export const generateTracerAnalyticsReport = (): TimerReport[] => {
  return Object.values(TracerTimers).map((timer) => timer.getReport());
};

export const GlobalDurationTimer = getDurationTimer();
