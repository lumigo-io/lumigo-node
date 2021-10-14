/* eslint-disable no-console */
const mysql = require('mysql');
const token = 'XXX';
const debug = true;
const lumigo = require('@lumigo/tracer')({
  token,
  debug,
  edgeHost: 'tracer-edge.internal-monitoring.golumigo.com',
});


function mysqlFunction() {
  var connection = mysql.createConnection({
    host: 'host',
    user: 'user',
    password: 'password',
    database: 'database',
  });

  connection.connect();
  connection.query("SELECT * FROM customers", function(error, results, fields) {
    if (error) throw error;
    console.log('The solution is: ', results);
  });

  connection.end();
}

const handler = async () => {
  mysqlFunction();
};
exports.handler = lumigo.trace(handler);
