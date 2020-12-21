module.exports = () => {
  return {
    target: 'node',
    mode: 'development',
    output: { libraryTarget: 'commonjs2' },
    externals: {
      mongodb: 'mongodb',
      redis: 'redis',
      pg: 'pg',
      tedious: 'tedious',
      msnodesqlv8: 'msnodesqlv8',
      mssql: 'mssql',
      mySql: 'mySql',
      'pg-pool': 'pg-pool',
    },
  };
};
