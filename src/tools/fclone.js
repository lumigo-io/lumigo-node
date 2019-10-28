const fclone = obj => {
  if (obj === undefined) return undefined;
  const getCircularReplacer = () => {
    // eslint-disable-next-line no-undef
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  };
  const s = JSON.stringify(obj, getCircularReplacer());
  return JSON.parse(s);
};
export { fclone };
