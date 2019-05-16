const { trace } = require('./lib/tracer');

module.exports = ({
  token,
  eventFilter = {},
  verbose = false,
  switchOff = false,
}) => {
  return { trace: trace({ token, eventFilter, verbose }) };
};
