module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "jest"
  ],
  extends: [
    "plugin:@typescript-eslint/eslint-recommended",
    "prettier"
  ],
  rules: {
    camelcase: "error",
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
    "jest/globals": true,
    node: true,
  },
};
