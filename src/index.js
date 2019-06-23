const { trace } = require('./tracer');
const { setVerboseMode, setSwitchOff } = require('./utils');

require('./hooks').default({ enabled: true });

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
