const { processUserHandler, runUserHandler, isResponseStreamFunction } = require('./tracer');

// Create the trace function that wraps user handlers
const trace = (options = {}) => (userHandler) => {
  // Create a decorated handler that processes the user handler
  const decoratedHandler = async (event, context, callback, responseStream) => {
    return await processUserHandler(userHandler, event, context, options, callback, responseStream);
  };

  // Handle response streaming if the original handler supports it
  if (isResponseStreamFunction(userHandler)) {
    decoratedHandler[Symbol.for('aws.lambda.runtime.handler.streaming')] = 'response';
  }

  return decoratedHandler;
};

// Export the trace function and other utilities
module.exports = {
  trace,
  processUserHandler,
  runUserHandler,
  isResponseStreamFunction
};
