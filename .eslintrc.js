module.exports = {
  parser: 'babel-eslint',
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['jest'],
  rules: {
    camelcase: 'error',
  },
  globals: {
    process: true,
    console: true,
    module: true,
    Promise: true,
    exports: true,
    Buffer: true,
    Set: true,
  },
  env: {
    'jest/globals': true,
    node: true,
  },
};
