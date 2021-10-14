/* eslint-disable no-console */
const Redis = require('ioredis');
const redis = new Redis(
  'url',
  {
    tls: {
      rejectUnauthorized: false,
    },
  }
);

const token = 'XXX';
const debug = true;
const lumigo = require('@lumigo/tracer')({
  token,
  debug,
  edgeHost: 'tracer-edge.internal-monitoring.golumigo.com',
});
async function mainFunction() {
  await redis.set('foo', 'bar'); // returns promise which resolves to string, "OK"

  // the format is: redis[SOME_REDIS_COMMAND_IN_LOWERCASE](ARGUMENTS_ARE_JOINED_INTO_COMMAND_STRING)
  // the js: ` redis.set("mykey", "Hello") ` is equivalent to the cli: ` redis> SET mykey "Hello" `

  // ioredis supports the node.js callback style
  const res = await redis.get('foo');
  console.log(res);
  return res;
}

const handler = async () => {
  await mainFunction();
};
exports.handler = lumigo.trace(handler);
