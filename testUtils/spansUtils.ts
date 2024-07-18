import { GenericSpan } from '../src/types/spans/basicSpan';

export const splitSpansByType = (spans: GenericSpan[]): { [type: string]: GenericSpan[] } => {
  const result = {};
  spans.forEach((span) => {
    const type = span.type || 'unknown';
    if (!result[type]) {
      result[type] = [];
    }
    result[type].push(span);
  });
  return result;
};
