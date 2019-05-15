const lambdaLocal = require('lambda-local');
const lumigo = require('./index')({ token: 'baba' });

describe('lumigo-node', () => {
  test('x', async () => {
    const userHandler = (event, context, callback) => {
      console.log('userhandler');
      return 'babax';
    };

    const r = await lambdaLocal.execute({
      event: {},
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      timeoutMs: 3000,
    });
    console.log(r);
  });
});
