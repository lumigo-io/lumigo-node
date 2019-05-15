const utils = require('./utils');

jest.mock('../package.json', () => ({
  name: '@lumigo/tracerMock',
  version: '1.2.3',
}));

describe('utils', () => {
  test('getTracerInfo', () => {
    expect(utils.getTracerInfo()).toEqual({
      name: '@lumigo/tracerMock',
      version: '1.2.3',
    });
  });

  test('getTraceId', () => {
    const awsXAmznTraceId =
      'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';
    const expected = {
      Parent: '59fa1aeb03c2ec1f',
      Root: '1-5b1d2450-6ac46730d346cad0e53f89d0',
      Sampled: '1',
    };
    expect(utils.getTraceId(awsXAmznTraceId)).toEqual(expected);
    expect(() => utils.getTraceId('x;y')).toThrowErrorMatchingSnapshot();
    expect(() =>
      utils.getTraceId('a=b;c=d;e=f')
    ).toThrowErrorMatchingSnapshot();
  });
});
