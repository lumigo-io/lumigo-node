/* eslint-disable no-console */
const { Sequelize, Model, DataTypes } = require('sequelize')
const token = 't_dc07fcd5c58d47ffa2b7c';
const debug = true;
const lumigo = require('@lumigo/tracer')({
  token,
  debug,
  edgeHost: 'tracer-edge.internal-monitoring.golumigo.com',
});
const connection = new Sequelize("host", "user", "password", {
  host: 'host',
  dialect: 'mysql',
  "dialectOptions": {
    "decimalNumbers": true
  },
});
const Customer = connection.define('customers', {
  name: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  address: {
    type: Sequelize.STRING
  }
}, {
  tableName: 'customers',
  timestamps: false
});
async function mysqlFunction() {

  const results = await Customer.findByPk("Ajeet Kumar");
  console.log(results);
}

const handler = async () => {
  await mysqlFunction();
};
exports.handler = lumigo.trace(handler);

