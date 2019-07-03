const { trace } = require('./tracer');
const { setVerboseMode, setSwitchOff } = require('./utils');

require('./hooks').default({ enabled: true });

module.exports = function({
  token,
  debug = false,
  edgeHost = '',
  eventFilter = {},
  verbose = false,
  switchOff = false,
}) {
  verbose && setVerboseMode();
  switchOff && setSwitchOff();

  return { trace: trace({ token, debug, edgeHost, switchOff, eventFilter }) };
};
