module.exports = () => {
  return {
    target: 'node',
    mode: 'production',
    output: { libraryTarget: 'commonjs2' },
    externals: {
      mongodb: 'mongodb',
      redis: 'redis',
      pg: 'pg',
      'pg-pool': 'pg-pool',
    },
  };
};
