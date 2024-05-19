import * as shimmer from 'shimmer';
import * as logger from './logger';
import { safeExecute, safeExecuteAsync } from './utils';

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
        const originalFnResult = originalFn.apply(this, args);
        safeAfterHook.call(this, args, originalFnResult, extenderContext);
        return originalFnResult;
      };
    };
    shimmerLib.wrap(module, funcName, wrapper);
  } catch (e) {
    logger.warn(`Wrapping of function ${funcName} failed`, options);
  }
};

/**
 * Wraps the given function with before and after hooks, and returns the wrapped function.
 * @param func Any function you would like to wrap
 * @param options: { beforeHook: Function, afterHook: Function }
 * @returns {*}
 */
export const hookFunc = (func, options = {}) => {
  const { beforeHook = noop, afterHook = noop } = options;
  const safeBeforeHook = safeExecute(beforeHook, `before hook of func fail`);
  const safeAfterHook = safeExecute(afterHook, `after hook of func fail`);

  const extenderContext = {};
  try {
    const wrapper = (originalFn) => {
      if (isFunctionAlreadyWrapped(originalFn)) {
        return originalFn;
      }
      return function (...args) {
        safeBeforeHook.call(this, args, extenderContext);
        const originalFnResult = originalFn.apply(this, args);
        safeAfterHook.call(this, args, originalFnResult, extenderContext);
        return originalFnResult;
      };
    };
    return getWrappedFunc(func, wrapper);
  } catch (e) {
    logger.warn(`Wrapping of function failed`, options);
    return func;
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

export const hookPromiseAsyncHandlers = (originalPromise, options) => {
  const { thenHandler = noop, catchHandler = noop } = options;
  // Then and catch handlers are async functions

  const safeThenHandler = safeExecuteAsync(thenHandler, `thenHandler of fail`);
  const safeCatchHandler = safeExecuteAsync(catchHandler, `catchHandler of fail`);

  const errorHandler = async (err) => {
    safeCatchHandler(err);
    throw err;
  };

  originalPromise.then(safeThenHandler).catch(errorHandler);
};

function defineProperty(obj, name, value) {
  const enumerable = !!obj[name] && obj.propertyIsEnumerable(name);
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: enumerable,
    writable: true,
    value: value,
  });
}

/**
 * Wraps a function with a given wrapper function, and marks the returned object as wrapped.
 * @param func Any function you would like to wrap
 * @param wrapper A wrapper function that gets as input the original function and returns a new function
 * @returns {*} The new wrapped function
 */
export const getWrappedFunc = (func, wrapper) => {
  if (!func) {
    logger.warn('must provide a function to wrap');
    return func;
  }

  if (!wrapper) {
    logger.warn('no wrapper function');
    return func;
  }

  const wrapped = wrapper(func);
  defineProperty(wrapped, '__wrapped', true);
  return wrapped;
};
