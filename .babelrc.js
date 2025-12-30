const targets = { node: 'current' };
const presets = [
  "@babel/preset-typescript",
  [ "@babel/preset-env", { targets } ]
];

const plugins = [
  [ "@babel/plugin-proposal-decorators", { "legacy": true } ],
  "@babel/plugin-transform-class-properties",
  "@babel/plugin-transform-optional-chaining",
];

module.exports = { presets, plugins };
