const axios = require('axios');
const https = require('https');

const token = 't_a595aa58c126575c5c41';
const edgeHost = 'kzc0w7k50d.execute-api.eu-west-1.amazonaws.com';
const debug = false;

const lumigo = require('./main')({ token, edgeHost, debug });

const myHandler = (event, context, callback) => {
  //const { data } = await axios.get('https://sagi.io');
  const req = https.request('https://sagi.io', res => {
    const { statusCode } = res;
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => callback(null, { statusCode, data }));
  });
  req.end();
};

exports.handler = lumigo.trace(myHandler);
