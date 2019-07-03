const token = 't_a595aa58c126575c5c41';
const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';

const lumigo = require('./main')({ token, edgeHost });

const myHandler = (event, context, callback) => {
  callback(null, 'heyoz');
};

exports.handler = lumigo.trace(myHandler);
