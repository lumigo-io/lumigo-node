const lumigo = require('@lumigo/tracer')({});

const ORIGINAL_HANDLER_KEY = 'LUMIGO_ORIGINAL_HANDLER';

const parseOriginalHandler = originalHandler => {
  if (!originalHandler) {
    throw Error('Could not load the original handler. Are you sure that the handler is correct?');
  }
  // The handler's format is `file_path.function`, where the `file_path` is inside `/var/task`
  if (!originalHandler.includes('.')) {
    throw Error('Could not parse the original handler - invalid format');
  }
  const handlerParts = originalHandler.split('.');
  const moduleName = handlerParts.slice(0, -1).join('.');
  let moduleFullName = moduleName;
  if (!moduleName.startsWith("/opt/")) {
    moduleFullName = `/var/task/${moduleName}`;
  }
  const functionName = handlerParts.slice(-1)[0];
  return [moduleFullName, functionName];
};

const removeLumigoFromStacktrace = err => {
  // Note: this function was copied from utils.js. Keep them both up to date.
  try {
    if (!err || !err.stack) {
      return err;
    }
    const { stack } = err;
    const stackArr = stack.split('\n');

    const patterns = ['/dist/lumigo.js:', 'auto-instrument'];
    const cleanedStack = stackArr.filter(v => !patterns.some(p => v.includes(p)));

    err.stack = cleanedStack.join('\n');

    return err;
  } catch (e) {
    return err;
  }
};

const handler = (event, context, callback) => {
  const originalHandler = process.env[ORIGINAL_HANDLER_KEY];
  const [moduleName, functionName] = parseOriginalHandler(originalHandler);
  let module;
  try {
    module = require(moduleName);
  } catch (e) {
    throw removeLumigoFromStacktrace(e);
  }
  if (!module[functionName]) {
    throw Error(
      `Could not find the handler's function (${functionName}) inside the handler's file (${moduleName})`
    );
  }
  return lumigo.trace(module[functionName])(event, context, callback);
};

module.exports = { ORIGINAL_HANDLER_KEY, _utils: {parseOriginalHandler}, handler };
try {
  // require the user's handler during initialization time, just as without Lumigo
  const [moduleName] = parseOriginalHandler(process.env[ORIGINAL_HANDLER_KEY]);
  require(moduleName);
} catch (e) {}
