module.exports = () => {
  return {
    target: 'node',
    mode: 'production',
    output: { libraryTarget: 'umd' },
  };
};
