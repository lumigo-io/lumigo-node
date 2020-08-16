module.exports = () => {
  return {
    target: 'node',
    mode: 'production',
    output: { libraryTarget: 'commonjs2' },
    externals: {
      mongodb: 'mongodb',
      redis: 'redis',
    },
  };
};
