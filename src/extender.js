import * as shimmer from 'shimmer';
import * as logger from './logger';
import { safeExecute } from './utils';

const noop = () => {};

const isFunctionAlreadyWrapped = (fn) => fn && fn.__wrapped;

export const hook = (module, funcName, options = {}, shimmerLib = shimmer) => {
  const { beforeHook = noop, afterHook = noop } = options;
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
        var originalFnResult;
        try {
          originalFnResult = originalFn.apply(this, args);
        } catch (err) {
          /*
           * If we are instrumenting a constructor, we need to use the 'new' keyword , and
           * there isn't really a great way to detect it other than looking into the error.
           */
          if (
            err instanceof TypeError &&
            err.message &&
            err.message.startsWith('Class constructor')
          ) {
            try {
              originalFnResult = new originalFn(...args);
            } catch (err) {
              throw err;
            }
          } else {
            throw err;
          }
        }
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
