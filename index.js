const { trace } = require('./lib/tracer');
const { setVerboseMode, setSwitchOff } = require('./lib/utils');

require('./lib/hooks').default({ enabled: true });

module.exports = function({
  token,
  edgeHost = '',
  eventFilter = {},
  verbose = false,
  switchOff = false,
}) {
  verbose && setVerboseMode();
  switchOff && setSwitchOff();

  return { trace: trace({ token, edgeHost, switchOff, eventFilter }) };
};
