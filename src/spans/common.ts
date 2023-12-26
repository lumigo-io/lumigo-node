import { filterObjectKeys, getEventEntitySize } from '../utils';
import { payloadStringify, truncate } from '../utils/payloadStringify';

export const normalizeQuery = (query: string | any): string => {
  if (typeof query === 'string') return truncate(query, getEventEntitySize());
  if (typeof query === 'object') {
    const filteredQuery = filterObjectKeys(query, (key) => !key.startsWith('_'));
    return payloadStringify(filteredQuery);
  }
  return 'Unknown';
};
