const { trace } = require('./tracer');
const { setVerboseMode, setSwitchOff } = require('./utils');

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
