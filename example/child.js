/* eslint-disable no-console */
const token = 't_867e2f98aac949d989da1';
const edgeHost = 'tracer-edge.internal-monitoring.golumigo.com';
const debug = true;
const lumigo = require('@lumigo/tracer')({ token, edgeHost, debug });
const request = require('request');
const axion = require('axios');

const AXIOS_URL =
  'https://run.mocky.io/v3/fbc709f9-fcbd-41ea-8db1-e55fee419dca/axios';
const URL = 'https://run.mocky.io/v3/fbc709f9-fcbd-41ea-8db1-e55fee419dca';

const childFn = (event, context, callback) => {
  axion.post(AXIOS_URL).then(() => {
    request(
      {
        headers: {},
        uri: URL,
        body: '',
        method: 'POST',
      },
      function(err, res, body) {
        callback(null, 'OK');
      }
    );
  });

  return 'ALL GOOD';
};

exports.handler = lumigo.trace(childFn);

// superChildFn({}, {}, () => {
//   superChildFn({}, {}, () => {
//     superChildFn({}, {}, () => {
//       console.log('asdas');
//     });
//   });
// });
