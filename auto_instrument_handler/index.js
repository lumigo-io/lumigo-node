const lumigo = require('@lumigo/tracer')({});

const ORIGINAL_HANDLER_KEY = 'LUMIGO_ORIGINAL_HANDLER';

const handler = (event, context, callback) => {
  const originalHandler = process.env[ORIGINAL_HANDLER_KEY];
  if (!originalHandler) {
    throw Error(
      'Could not load the original handler. Are you sure that the handler is correct?'
    );
  }
  const handlerParts = originalHandler.split('.');
  const moduleName = `/var/task/${handlerParts.slice(0, -1).join('.')}`;
  const functionName = handlerParts.slice(-1);
  let module;
  try {
    module = require(moduleName);
  } catch (e) {
    throw Error(
      "Could not find the original handler. Please follow lumigo's docs: https://docs.lumigo.io/"
    );
  }
  return lumigo.trace(module[functionName])(event, context, callback);
};

module.exports = { ORIGINAL_HANDLER_KEY, handler };