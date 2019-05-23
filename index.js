const { trace } = require('./lib/tracer');

require('./lib/hooks');

module.exports = ({
  token,
  eventFilter = {},
  verbose = false,
  switchOff = false,
}) => {
  return { trace: trace({ token, eventFilter, verbose }) };
};
