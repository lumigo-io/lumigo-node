/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This code was copied from:
 * https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/blob/main/src/utils/UserFunction.ts
 *
 * This module defines the functions for loading the user's code as specified
 * in a handler string.
 */

"use strict";

const {
  HandlerNotFound,
  MalformedHandlerName,
  ImportModuleError,
  UserCodeSyntaxError
} = require("./Errors.js");
const path = require("path");
const fs = require("fs");
const FUNCTION_EXPR = /^([^.]*)\.(.*)$/;
const RELATIVE_PATH_SUBSTRING = "..";

let SUPPORTED_EXTENSIONS;

/**
 * Break the full handler string into two pieces, the module root and the actual
 * handler string.
 * Given './somepath/something/module.nestedobj.handler' this returns
 * ['./somepath/something', 'module.nestedobj.handler']
 */
function _moduleRootAndHandler(fullHandlerString) {
  let handlerString = path.basename(fullHandlerString);
  let moduleRoot = fullHandlerString.substring(
    0,
    fullHandlerString.indexOf(handlerString)
  );
  return [moduleRoot, handlerString];
}

/**
 * Split the handler string into two pieces: the module name and the path to
 * the handler function.
 */
function _splitHandlerString(handler) {
  let match = handler.match(FUNCTION_EXPR);
  if (!match || match.length != 3) {
    throw new MalformedHandlerName("Bad handler");
  }
  return [match[1], match[2]]; // [module, function-path]
}

/**
 * Resolve the user's handler function from the module.
 */
function _resolveHandler(object, nestedProperty) {
  return nestedProperty.split(".").reduce((nested, key) => {
    return nested && nested[key];
  }, object);
}

/**
 * Verify that the provided path can be loaded as a file per:
 * https://nodejs.org/dist/latest-v10.x/docs/api/modules.html#modules_all_together
 * @param string - the fully resolved file path to the module
 * @return bool
 */
function _canLoadAsFile(modulePath, supportedExtensions) {
  if (!!fs.existsSync(modulePath)) {
    return modulePath;
  }

  for (var extension of supportedExtensions) {
    const handlerFile = modulePath + '.' + extension;
    if (!!fs.existsSync(handlerFile)) {
      return handlerFile;
    }
  }
}

/**
 * Attempt to load the user's module.
 * Attempts to directly resolve the module relative to the application root,
 * then falls back to the more general require().
 */
function _tryRequire(appRoot, moduleRoot, module) {
  let lambdaStylePath = path.resolve(appRoot, moduleRoot, module);
  let handlerFile = _canLoadAsFile(lambdaStylePath, ['js', 'cjs']);
  if (!!handlerFile) {
    if (handlerFile.endsWith('.cjs')) {
        return require(handlerFile);
      }
    return require(lambdaStylePath);
  } else {
    // Why not just require(module)?
    // Because require() is relative to __dirname, not process.cwd(). And the
    // runtime implementation is not located in /var/task
    let nodeStylePath = require.resolve(module, {
      paths: [appRoot, moduleRoot]
    });
    return require(nodeStylePath);
  }
}

/**
 * Load the user's application or throw a descriptive error.
 * @throws Runtime errors in two cases
 *   1 - UserCodeSyntaxError if there's a syntax error while loading the module
 *   2 - ImportModuleError if the module cannot be found
 */
function _loadUserApp(appRoot, moduleRoot, module) {
  try {
    return _tryRequire(appRoot, moduleRoot, module);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new UserCodeSyntaxError(e);
    } else if (e.code !== undefined && e.code === "MODULE_NOT_FOUND") {
      throw new ImportModuleError(e);
    } else {
      throw e;
    }
  }
}

/**
 * Load the user's application or throw a descriptive error.
 * @throws Runtime errors in two cases
 *   1 - UserCodeSyntaxError if there's a syntax error while loading the module
 *   2 - ImportModuleError if the module cannot be found
 */
async function _loadUserAppAsync(appRoot, moduleRoot, module) {
  try {
    return _tryImportOrRequire(appRoot, moduleRoot, module);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new UserCodeSyntaxError(e);
    } else if (e.code !== undefined && e.code === "MODULE_NOT_FOUND") {
      throw new ImportModuleError(e);
    } else {
      throw e;
    }
  }
}

/**
 * Searches for the nearest package.json file, and returns `true` if the
 * package.json has type `module`. See https://nodejs.org/api/modules.html#enabling
 * @param {*} currentPath 
 */
function isEsModule(handlerFile) {
  /*
   * If, while traversing the directory tree upwards, we hit root
   * or a node_modules folder (which means we are getting out of the dependencies),
   * we stop.
   */
  let currentDir = path.dirname(handlerFile);
  while (currentDir !== '/' && !currentDir.endsWith('/node_modules')) {
    const packageJsonFile = path.resolve(path.join(currentDir, 'package.json'));

    if (fs.existsSync(packageJsonFile)) {
      const { type } = require(packageJsonFile);
 
      return type === 'module';
    }

    currentDir = path.dirname(currentDir);
  }

  return false;
}

/**
 * Attempt to load the user's module.
 * Attempts to directly resolve the module relative to the application root,
 * then falls back to the more general require().
 */
async function _tryImportOrRequire(appRoot, moduleRoot, module) {
  let lambdaStylePath = path.resolve(appRoot, moduleRoot, module);
  let handlerFile = _canLoadAsFile(lambdaStylePath, ['js', 'mjs', 'cjs']);

  /*
   * .cjs files must always be loaded as CommonJS modules (i.e., via `require`), see
   * https://nodejs.org/api/modules.html#enabling.
   *
   * .mjs are always loaded as ES modules.
   * 
   * .js files could still be required to load as ES modules (i.e., via `import`) if
   * their type in the nearest package.json is `module`, see https://nodejs.org/api/modules.html#enabling
   */
  const esModuleType = 'esmodule';
  const commonJsModuleType = 'commonjs';

  let moduleType = '';
  if (!!handlerFile) {
    if (handlerFile.endsWith('.mjs')) {
      moduleType = esModuleType;
    } else if (handlerFile.endsWith('.cjs')) {
      moduleType = commonJsModuleType;
    } else if (handlerFile.endsWith('.js')) {
      moduleType = isEsModule(handlerFile) ? esModuleType : commonJsModuleType;
    } else {
      moduleType = commonJsModuleType;
    }
  }

  switch (moduleType) {
    case esModuleType:
      return await import(handlerFile);
    case commonJsModuleType:
      if (handlerFile.endsWith('.cjs')) {
        return require(handlerFile);
      }
      return require(lambdaStylePath);
    default:
      // Why not just require(module)?
      // Because require() is relative to __dirname, not process.cwd(). And the
      // runtime implementation is not located in /var/task
      let nodeStylePath = require.resolve(module, {
        paths: [appRoot, moduleRoot]
      });
      return require(nodeStylePath); 
  }
}

function _throwIfInvalidHandler(fullHandlerString) {
  if (fullHandlerString.includes(RELATIVE_PATH_SUBSTRING)) {
    throw new MalformedHandlerName(
      `'${fullHandlerString}' is not a valid handler name. Use absolute paths when specifying root directories in handler names.`
    );
  }
}

/**
 * Load the user's function synchronously with the approot and the handler string.
 * @todo Remove this code path when Node.js 12 is no longer supported. 
 *
 * @param appRoot {string}
 *   The path to the application root.
 * @param handlerString {string}
 *   The user-provided handler function in the form 'module.function'.
 * @return userFuction {function}
 *   The user's handler function. This function will be passed the event body,
 *   the context object, and the callback function.
 * @throws In five cases:-
 *   1 - if the handler string is incorrectly formatted an error is thrown
 *   2 - if the module referenced by the handler cannot be loaded
 *   3 - if the function in the handler does not exist in the module
 *   4 - if a property with the same name, but isn't a function, exists on the
 *       module
 *   5 - the handler includes illegal character sequences (like relative paths
 *       for traversing up the filesystem '..')
 *   Errors for scenarios known by the runtime, will be wrapped by Runtime.* errors.
 */
function loadSync(appRoot, fullHandlerString) {
  _throwIfInvalidHandler(fullHandlerString);

  let [moduleRoot, moduleAndHandler] = _moduleRootAndHandler(fullHandlerString);
  let [module, handlerPath] = _splitHandlerString(moduleAndHandler);

  let userApp = _loadUserApp(appRoot, moduleRoot, module);
  let handlerFunc = _resolveHandler(userApp, handlerPath);

  if (!handlerFunc) {
    throw new HandlerNotFound(
      `${fullHandlerString} is undefined or not exported`
    );
  }

  if (typeof handlerFunc !== "function") {
    throw new HandlerNotFound(`${fullHandlerString} is not a function`);
  }

  return handlerFunc;
};

/**
 * Load the user's function asynchronously with the approot and the handler string.
 * If the user function is an ES module, load it via `import`.
 * @param appRoot {string}
 *   The path to the application root.
 * @param handlerString {string}
 *   The user-provided handler function in the form 'module.function'.
 * @return userFuction {function}
 *   The user's handler function. This function will be passed the event body,
 *   the context object, and the callback function.
 * @throws In five cases:-
 *   1 - if the handler string is incorrectly formatted an error is thrown
 *   2 - if the module referenced by the handler cannot be loaded
 *   3 - if the function in the handler does not exist in the module
 *   4 - if a property with the same name, but isn't a function, exists on the
 *       module
 *   5 - the handler includes illegal character sequences (like relative paths
 *       for traversing up the filesystem '..')
 *   Errors for scenarios known by the runtime, will be wrapped by Runtime.* errors.
 */
async function loadAsync(appRoot, fullHandlerString) {
  _throwIfInvalidHandler(fullHandlerString);

  let [moduleRoot, moduleAndHandler] = _moduleRootAndHandler(fullHandlerString);
  let [module, handlerPath] = _splitHandlerString(moduleAndHandler);

  let userApp = await _loadUserAppAsync(appRoot, moduleRoot, module);
  let handlerFunc = _resolveHandler(userApp, handlerPath);

  if (!handlerFunc) {
    throw new HandlerNotFound(
      `${fullHandlerString} is undefined or not exported`
    );
  }

  if (typeof handlerFunc !== "function") {
    throw new HandlerNotFound(`${fullHandlerString} is not a function`);
  }

  return handlerFunc;
};

switch (process.env.AWS_EXECUTION_ENV) {
  case 'AWS_Lambda_nodejs12.x':
    module.exports.load = loadSync;
    break;
  default:
    module.exports.load = loadAsync;
    break;
}
