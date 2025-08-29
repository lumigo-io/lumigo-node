var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as shimmer from 'shimmer';
import * as logger from './logger';
import { safeExecute } from './utils';
const noop = () => { };
const isFunctionAlreadyWrapped = (fn) => fn && fn.__wrapped;
export const hook = (module, funcName, options = {}, shimmerLib = shimmer) => {
    logger.debug(`Applying hook to function ${funcName}`, {
        hasBeforeHook: !!options.beforeHook,
        hasAfterHook: !!options.afterHook,
        moduleType: typeof module,
    });
    const { beforeHook = noop, afterHook = noop } = options;
    const safeBeforeHook = safeExecute(beforeHook, `before hook of ${funcName} fail`);
    const safeAfterHook = safeExecute(afterHook, `after hook of ${funcName} fail`);
    const extenderContext = {};
    try {
        const wrapper = (originalFn) => {
            if (isFunctionAlreadyWrapped(originalFn)) {
                logger.debug(`Function ${funcName} is already wrapped, skipping`);
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
    }
    catch (e) {
        logger.warn(`Wrapping of function ${funcName} failed`, options);
    }
};
export const hookPromise = (originalPromise, options) => {
    const { thenHandler = noop, catchHandler = noop } = options;
    const safeThenHandler = safeExecute(thenHandler, `thenHandler of fail`);
    const safeCatchHandler = safeExecute(catchHandler, `catchHandler of fail`);
    const errorHandler = (err) => __awaiter(void 0, void 0, void 0, function* () {
        safeCatchHandler(err);
        throw err;
    });
    originalPromise.then(safeThenHandler).catch(errorHandler);
};
