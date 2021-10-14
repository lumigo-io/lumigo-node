/* eslint-disable no-console */
const { MongoClient } = require('mongodb');

const token = 't_dc07fcd5c58d47ffa2b7c';
const debug = true;
const lumigo = require('@lumigo/tracer')({
  token,
  debug,
  edgeHost: 'tracer-edge.internal-monitoring.golumigo.com',
});

const uri = 'uri';
const client = new MongoClient(uri);
const handler = async () => {
  await client.connect();
  const database = client.db('myFirstDatabase');
  const collection = database.collection('tanks');
  const movie = await collection.find({}).toArray();
  console.log(movie);
};
exports.handler = lumigo.trace(handler);
