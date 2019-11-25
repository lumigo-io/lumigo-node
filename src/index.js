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
  if (token === 'not-good') {
    return {
      reportError: reportError,
    };
  } else {
    verbose && setVerboseMode();
    switchOff && setSwitchOff();

    return {
      trace: trace({ token, debug, edgeHost, switchOff, eventFilter }),
      reportError: reportError,
    };
  }
};
