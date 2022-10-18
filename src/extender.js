import * as shimmer from 'shimmer';
import * as logger from './logger';
import { safeExecute } from './utils';

const noop = () => {};

const isFunctionAlreadyWrapped = (fn) => fn && fn.__wrapped;

export const hook = (module, funcName, options = {}, shimmerLib = shimmer) => {
  const { isConstructor = false, beforeHook = noop, afterHook = noop } = options;
  const safeBeforeHook = safeExecute(beforeHook, `before hook of ${funcName} fail`);
  const safeAfterHook = safeExecute(afterHook, `after hook of ${funcName} fail`);
  const extenderContext = {};
  try {
    const wrapper = (originalFn) => {
      if (isFunctionAlreadyWrapped(originalFn)) {
        return originalFn;
      }
      return function (...args) {
        safeBeforeHook.call(this, args, extenderContext);
        const originalFnResult = isConstructor
          ? new originalFn(...args)
          : originalFn.apply(this, args);
        safeAfterHook.call(this, args, originalFnResult, extenderContext);
        return originalFnResult;
      };
    };
    shimmerLib.wrap(module, funcName, wrapper);
  } catch (e) {
    logger.debug(`Hooking of function ${funcName} failed`, e);
  }
};

export const hookPromise = (originalPromise, options) => {
  const { thenHandler = noop, catchHandler = noop } = options;
  const safeThenHandler = safeExecute(thenHandler, `thenHandler of fail`);
  const safeCatchHandler = safeExecute(catchHandler, `catchHandler of fail`);
  const errorHandler = async (err) => {
    safeCatchHandler(err);
    throw err;
  };
  originalPromise.then(safeThenHandler).catch(errorHandler);
};
