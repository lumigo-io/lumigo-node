const targets = { node: 'current' };
const presets = [['@babel/preset-env', { targets }]];

const plugins = ['@babel/plugin-proposal-class-properties'];

module.exports = { presets, plugins };
