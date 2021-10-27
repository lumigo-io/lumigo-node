export function Ioredis(path, options) {
  this.path = path;
  this.options = options || {};
  // eslint-disable-next-line camelcase
  this.connection_options = path;
  return {
    set: (key, value) => {
      return this.sendCommand({
        promise: new Promise((resolve, reject) => {
          if (!this.options.shouldFail) {
            resolve('OK');
          } else {
            reject('Bad data');
          }
        }),
        args: [key, value],
        command: 'set'
      });
    },
  };
}

Ioredis.prototype.sendCommand = async function (args) {
  return await args.promise;
};
