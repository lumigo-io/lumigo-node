module.exports = {
  parser: 'babel-eslint',
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['jest'],
  globals: {
    process: true,
    console: true,
  },
  env: {
    'jest/globals': true,
  },
};
