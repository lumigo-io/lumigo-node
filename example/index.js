/* eslint-disable no-console */

const token = 'XXX';
const debug = true;
const lumigo = require('@lumigo/tracer')({ token, debug });

const AWS = require('aws-sdk');

const handler = async () => {

  return 'OK';
};

exports.handler = lumigo.trace(handler);

exports.handler()
