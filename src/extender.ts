import shimmer from 'shimmer';
import * as logger from './logger';
import { safeExecute } from './utils';

const noop = (): void => {};

const isFunctionAlreadyWrapped = (fn): boolean => fn && fn.__wrapped;

export interface ExtenderContext {
  [key: string]: any;
}

export interface ExtenderOptions {
  beforeHook?: (args: any[], extenderContext: ExtenderContext) => void;
  afterHook?: (args: any[], functionResult: any, extenderContext: ExtenderContext) => void;
}

export const hook = (module, funcName: string, options: ExtenderOptions = {}) => {
  const { beforeHook = noop, afterHook = noop } = options;
  const safeBeforeHook = safeExecute(beforeHook, `before hook of ${funcName} fail`);
  const safeAfterHook = safeExecute(afterHook, `after hook of ${funcName} fail`);
  const extenderContext = {};
  try {
    const wrapper = (originalFn) => {
      if (isFunctionAlreadyWrapped(originalFn)) return originalFn;
      return function (...args) {
        safeBeforeHook.call(this, args, extenderContext);
        const originalFnResult = originalFn.apply(this, args);
        safeAfterHook.call(this, args, originalFnResult, extenderContext);
        return originalFnResult;
      };
    };
    shimmer.wrap(module, funcName, wrapper);
  } catch (e) {
    logger.warn(`Wrapping of function ${funcName} failed - ${e.toString()}`, options);
  }
};

export const hookPromise = (originalPromise, options) => {
  const { beforeThen = noop, afterThen = noop, beforeCatch = noop, afterCatch = noop } = options;
  hook(originalPromise, 'then', {
    beforeHook: (args) => {
      hook(args, '0', {
        beforeHook: beforeThen,
        afterHook: afterThen,
      });
    },
  });
  hook(originalPromise, 'catch', {
    beforeHook: (args) => {
      hook(args, '0', {
        beforeHook: beforeCatch,
        afterHook: afterCatch,
      });
    },
  });
};
