import { trace } from './tracer';
import { setSwitchOff, setVerboseMode, reportError } from './utils';
import { debug } from './logger';

debug('Tracer imported');

module.exports = function({
  token = 'not-good',
  debug = false,
  edgeHost = '',
  eventFilter = {},
  verbose = false,
  switchOff = false,
}) {
  // eslint-disable-next-line no-undef
  global.reportError = reportError;
  verbose && setVerboseMode();
  switchOff && setSwitchOff();

  return {
    trace: trace({ token, debug, edgeHost, switchOff, eventFilter }),
  };
};
