import { trace } from './tracer';
import {
  setSwitchOff,
  setVerboseMode,
  LUMIGO_REPORT_ERROR_STRING,
} from './utils';
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

// eslint-disable-next-line no-undef
global.lumigoReportError = function(msg) {
  try {
    // eslint-disable-next-line no-console
    console.log(LUMIGO_REPORT_ERROR_STRING, msg);
  } catch {
    // not printing the msg
    debug('failed to print using reportError', { msg });
  }
};
