import { payloadStringify } from './payloadStringify';

describe('payloadStringify', () => {
  test('payloadStringify -> simple flow', () => {
    const payload = { a: 2, b: 3 };

    const result = payloadStringify(payload);

    expect(result).toEqual('{"a":2,"b":3}');
  });
});
