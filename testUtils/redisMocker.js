function RedisClient(options, mockedOptions = {}) {
  this.connection_options = options;
  this.stream = { writable: true };
  this.ready = !mockedOptions.notReady;
  return {
    set: (key, value, callback) => {
      this.internal_send_command({
        command: 'set',
        args: [key, value],
        callback: callback,
      });
    },
  };
}

//In this implementation we create only 1 client at time
export const createMockedClient = (options = {}) => {
  const { shouldFail, notReady } = options;
  RedisClient.prototype.internal_send_command = function(args) {
    if (!shouldFail) {
      args.callback(null, 'OK');
    } else {
      args.callback('Bad data', null);
    }
  };
  return {
    RedisClient: RedisClient,
    createClient: options => new RedisClient(options, { notReady }),
  };
};
