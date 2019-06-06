const lumigo = require('@lumigo/tracer')({ token: 't_a595aa58c126575c5c41' });

const myHandler = (event, context, callback) => {
  callback(null, 'XYZ baba was here');
};

exports.handler = lumigo.trace(myHandler);
