const { trace } = require('./lib/tracer');

module.exports = ({ token, eventFilter }) => {
  return { trace: trace(token, eventFilter) };
};
