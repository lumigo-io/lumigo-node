export const runOneTimeWrapper = (func: Function, context: any = undefined): Function => {
  let done = false;
  return (...args) => {
    if (!done) {
      const result = func.apply(context || this, args);
      done = true;
      return result;
    }
  };
};

export const hasOwnProperty = (object: any, property: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, property);
