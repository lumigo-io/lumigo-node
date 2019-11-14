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

  return {
    trace: trace({ token, debug, edgeHost, switchOff, eventFilter }),
    report_error: msg => {
      report_error(msg);
    },
  };
};

const report_error = msg => {
  let msg_with_initals = `${LUMIGO_REPORT_ERROR_STRING} ${msg}`;
  // eslint-disable-next-line no-console
  console.log(msg_with_initals);
};
