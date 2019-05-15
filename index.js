const trace = (token, eventFilter) => userHandler => (
  event,
  context,
  callback
) => {
  console.log('baba is the king');
  const ret = userHandler(event, context, callback);
  console.log('xyzbaba is the king');
  return ret;
};

module.exports = ({ token, eventFilter }) => {
  return { trace: trace(token, eventFilter) };
};
