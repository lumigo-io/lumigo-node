import { validateTag } from './globals';

module.exports = {
  info: (message, type = 'ProgrammaticInfo', extra = {}) => {
    log(20, message, type, extra);
  },
  warn: (message, type = 'ProgrammaticWarn', extra = {}) => {
    log(30, message, type, extra);
  },
  error: (message, type = 'ProgrammaticError', extra = {}) => {
    log(40, message, type, extra);
  },
};

const log = (level, message, type, extra) => {
  const actual = Object.entries(extra)
    .filter(([key, value]) => validateTag(key, value))
    .slice(0, 10)
    .reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {});

  const text = JSON.stringify({ message, type, level, ...actual });
  // eslint-disable-next-line no-console
  console.log(`[LUMIGO_LOG] ${text}`);
};
