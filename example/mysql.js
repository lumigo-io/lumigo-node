/* eslint-disable no-console */
const mysql = require('mysql');
const token = 't_dc07fcd5c58d47ffa2b7c';
const debug = true;
const lumigo = require('@lumigo/tracer')({
  token,
  debug,
  edgeHost: 'tracer-edge.internal-monitoring.golumigo.com',
});


function mysqlFunction() {
  var connection = mysql.createConnection({
    host: 'nnsgluut5mye50or.cbetxkdyhwsb.us-east-1.rds.amazonaws.com',
    user: 'ubgeb9bo2cfatukc',
    password: 'eqey4j86qz7ro086',
    database: 'cd78s0fhvb2w82i9',
  });

  connection.connect();
  const create = "CREATE TABLE customers (name VARCHAR(255), address VARCHAR(255))";
  const insert = "INSERT INTO customers (name, address) VALUES ('Ajeet Kumar', 'Allahabad')";
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
