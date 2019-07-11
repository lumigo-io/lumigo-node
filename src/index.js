import { trace } from './tracer';
import { setSwitchOff, setVerboseMode } from './utils';
import * as logger from './logger';

logger.debug('Tracer imported');

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
