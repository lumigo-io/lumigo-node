const { trace } = require('./lib/tracer');
const { setVerboseMode } = require('./lib/utils');

require('./lib/hooks').default({ enabled: true });

module.exports = ({
  token,
  eventFilter = {},
  verbose = false,
  switchOff = false,
}) => {
  verbose && setVerboseMode();
  return { trace: trace({ token, eventFilter, verbose }) };
};
