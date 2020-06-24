import shimmer from 'shimmer';
import * as logger from './logger';
import { safeExecute } from './utils';

const noop = () => {};

export const hook = (module, funcName, options = {}) => {
  const { beforeHook = noop, afterHook = noop } = options;
  const safeBeforeHook = safeExecute(beforeHook, `before hook of ${funcName} fail`);
  const safeAfterHook = safeExecute(afterHook, `after hook of ${funcName} fail`);
  try {
    const wrapper = originalFn => {
      if (originalFn && originalFn.__wrapped) return originalFn;
      return function(...args) {
        safeBeforeHook.apply(this, args);
        const originalFnResult = originalFn.apply(this, args);
        safeAfterHook.apply(this, args);
        return originalFnResult;
      };
    };
    shimmer.wrap(module, funcName, wrapper);
  } catch (e) {
    logger.warn(`Wrapping of function ${funcName} failed`, options);
  }
};
