function fromEntries(iterable) {
  return [...iterable].reduce((obj, [key, val]) => {
    obj[key] = val;
    return obj;
  }, {});
}

const noCirculars = v => {
  const set = new Set();
  const noCirculars = v => {
    if (Array.isArray(v)) return v.map(noCirculars);
    if (typeof v === 'object' && v !== null) {
      if (set.has(v)) return '[Circular]';
      set.add(v);

      return fromEntries(Object.entries(v).map(([k, v]) => [k, noCirculars(v)]));
    }
    return v;
  };
  return noCirculars(v);
};
export { noCirculars };
