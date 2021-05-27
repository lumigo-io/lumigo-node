const lumigo = require('@lumigo/tracer')({});
const { load } = require('./aws/aws-user-function.js');

const ORIGINAL_HANDLER_KEY = 'LUMIGO_ORIGINAL_HANDLER';

const getHandler = () => {
  if (process.env[ORIGINAL_HANDLER_KEY] === undefined)
    throw Error('Could not load the original handler. Please contact Lumigo.');
  return load(
      process.env.LAMBDA_TASK_ROOT,
      process.env[ORIGINAL_HANDLER_KEY]
  );
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
  let userHandler;
  try {
    userHandler = getHandler();
  } catch (e) {
    throw removeLumigoFromStacktrace(e);
  }
  return lumigo.trace(userHandler)(event, context, callback);
};

module.exports = { ORIGINAL_HANDLER_KEY, handler };
try {
  // require the user's handler during initialization time, just as without Lumigo
   getHandler();
}
catch (e) {}