module.exports = {
  parser: 'babel-eslint',
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['jest'],
  globals: {
    process: true,
    console: true,
    module: true,
    Promise: true,
    exports: true,
    Buffer: true,
  },
  env: {
    'jest/globals': true,
  },
};
