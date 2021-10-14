/* eslint-disable no-console */
const mysql = require('mysql2');
const token = 't_dc07fcd5c58d47ffa2b7c';
const debug = true;
const lumigo = require('@lumigo/tracer')({
  token,
  debug,
  edgeHost: 'tracer-edge.internal-monitoring.golumigo.com',
});


async function mysqlFunction() {

  var connection = mysql.createConnection({
    host: 'nnsgluut5mye50or.cbetxkdyhwsb.us-east-1.rds.amazonaws.com',
    user: 'ubgeb9bo2cfatukc',
    password: 'eqey4j86qz7ro086',
    database: 'cd78s0fhvb2w82i9',
  });

  const results = await connection.promise().query("SELECT * FROM customers");
  console.log(results);
  connection.execute("SELECT * FROM customers", function(error, results, fields) {
    if (error) throw error;
    console.log('The solution is: ', results);
  });

  connection.end();
}

const handler = async () => {
  mysqlFunction();
};

exports.handler = lumigo.trace(handler);
