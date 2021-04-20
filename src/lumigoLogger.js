import { validateTag } from './globals';
import { MAX_ELEMENTS_IN_EXTRA } from './tracer';

module.exports = {
  info: (message, { type = 'ProgrammaticInfo', extra = {} } = {}) => {
    log(20, message, type, extra);
  },
  warn: (message, { type = 'ProgrammaticWarn', extra = {} } = {}) => {
    log(30, message, type, extra);
  },
  error: (message, { extra= {}, err= null, type = null } = {}) => {
    extra = extra || {};
    if (err) {
      extra.rawException = err.message || err.msg || err.toString();
      type = type || err.constructor.name;
    }
    type = type || 'ProgrammaticError';
    log(40, message, type, extra, err);
  },
};

const log = (level, message, type, extra) => {
  const filteredExtra = Object.entries(extra)
    .filter(([key, value]) => validateTag(key, value))
    .slice(0, MAX_ELEMENTS_IN_EXTRA)
    .reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {});

  let actual = { message, type, level };
  if (Object.keys(extra).length > 0) {
    actual.extra = filteredExtra;
  }
  const text = JSON.stringify(actual);
  // eslint-disable-next-line no-console
  console.log(`[LUMIGO_LOG] ${text}`);
};
