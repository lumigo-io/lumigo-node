const targets = { node: 'current' };
const presets = ["@babel/preset-typescript", ['@babel/preset-env', { targets }]];

const plugins = [
  '@babel/plugin-proposal-class-properties',
  '@babel/plugin-proposal-optional-chaining',
];

module.exports = { presets, plugins };
