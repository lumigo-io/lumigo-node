import * as logger from '../logger';

export const safeRequire = libId => {
  try {
    const customReq =
      // eslint-disable-next-line no-undef
      typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
    const path = customReq.resolve(libId);
    return customReq(path);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      logger.warn('Cant load Module', {
        error: e,
        libId: libId,
      });
    }
  }
  return undefined;
};
