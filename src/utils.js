export const isAsyncFn = fn =>
  fn &&
  fn['constructor'] &&
  fn.constructor['name'] &&
  fn.constructor.name === 'AsyncFunction';
