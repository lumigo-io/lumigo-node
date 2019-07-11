const axios = require('axios');
const token = 't_a595aa58c126575c5c41';
const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
const debug = true;

const lumigo = require('./main')({ token, edgeHost, debug });
//const LumigoTracer = require('@lumigo/tracer');
//const RellyTracer = new LumigoTracer({ token, host: edgeHost });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const yikes = async () => {
  await sleep(5000);
  const { data } = await axios.get('https://sagi.io');
  console.log('SAGIZZ4');
};
const childFn = async (event, context, callback) => {
  //context.callbackWaitsForEmptyEventLoop = false;
  yikes();
  callback(null, 'zarathustra4');
  /*
  const c = () => {
    throw new Error('bla');
  };
  const b = () => c();
  const a = () => b();
  a();
  */
};

//exports.handler = RellyTracer.trace(childFn);
exports.handler = lumigo.trace(childFn);
