import { trace } from './tracer';
import { setSwitchOff, setVerboseMode } from './utils';
import { debug } from './logger';

debug('Tracer imported');

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
