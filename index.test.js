const lambdaLocal = require('lambda-local');
const lumigo = require('./index')({ token: 'baba' });

describe('lumigo-node', () => {
  test('x', async () => {
    const expected = 'Satoshi was here';
    const userHandler = (event, context, callback) => {
      return expected;
    };

    const r = await lambdaLocal.execute({
      event: {},
      lambdaFunc: { handler: lumigo.trace(userHandler) },
      timeoutMs: 3000,
      verboseLevel: 3,
    });

    expect(r).toEqual(expected);
  });
});
