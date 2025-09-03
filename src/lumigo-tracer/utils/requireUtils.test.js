import { safeRequire } from './requireUtils';

describe('requireUtils', () => {
  test('safeRequire -> simple flow', () => {
    const http = require('http');

    const result = safeRequire('http');

    expect(http).toEqual(result);
  });

  test('safeRequire -> not exist', () => {
    const result = safeRequire('BlaBlaBlaBla');

    expect(result).toBeFalsy();
  });

  test('safeRequire -> other error', () => {
    jest.doMock('fs', () => {
      throw Error('RandomError');
    });

    const result = safeRequire('fs');

    expect(result).toBeFalsy();
  });
});
