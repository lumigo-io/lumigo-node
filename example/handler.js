const token = 't_a595aa58c126575c5c41';
const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';

//const lumigo = require('./main')({ token, edgeHost });

const myHandler = (event, context, callback) => {
  //console.log(JSON.stringify(process.env, null, 2));
  console.log('SAGI A');
  console.log(process.env['_X_AMZN_TRACE_ID']);
  console.log('SAGI B');
  callback(null, 'heyoz');
};

exports.handler = myHandler;
