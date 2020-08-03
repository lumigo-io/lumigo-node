import { payloadStringify, keyToOmitRegexes } from './payloadStringify';
import { LUMIGO_SECRET_MASKING_REGEX, LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP } from '../utils';

describe('payloadStringify', () => {
  test('payloadStringify -> simple flow -> object', () => {
    const payload = { a: 2, b: 3 };

    const result = payloadStringify(payload);

    expect(result).toEqual('{"a":2,"b":3}');
  });

  test('payloadStringify -> simple flow -> null', () => {
    const payload = null;

    const result = payloadStringify(payload);

    expect(result).toEqual('null');
  });

  test('payloadStringify -> simple flow -> complex object', () => {
    const payload = { a: [{ a: 2 }], b: 3 };

    const result = payloadStringify(payload);

    expect(result).toEqual('{"a":[{"a":2}],"b":3}');
  });

  test('payloadStringify -> simple flow -> list', () => {
    const payload = [2, 3];

    const result = payloadStringify(payload);

    expect(result).toEqual('[2,3]');
  });

  test('payloadStringify -> simple flow -> complex list', () => {
    const payload = [{ a: 2 }, 3];

    const result = payloadStringify(payload);

    expect(result).toEqual('[{"a":2},3]');
  });

  test('payloadStringify -> simple flow -> str', () => {
    const payload = 'STR';

    const result = payloadStringify(payload);

    expect(result).toEqual('"STR"');
  });

  test('payloadStringify -> simple flow -> number', () => {
    const payload = 2;

    const result = payloadStringify(payload);

    expect(result).toEqual('2');
  });

  test('payloadStringify -> simple flow -> undefined', () => {
    const payload = undefined;

    const result = payloadStringify(payload);

    expect(result).toEqual('');
  });

  test('payloadStringify -> prune all', () => {
    const payload = { a: 2, b: 3 };

    const result = payloadStringify(payload, 0);

    expect(result).toEqual('');
  });

  test('payloadStringify -> secret masking', () => {
    const payload = { a: 2, password: 'CoolPass35' };

    const result = payloadStringify(payload);

    expect(result).toEqual('{"a":2,"password":"****"}');
  });

  test('payloadStringify -> prune after 10B', () => {
    const payload = {
      a: 2,
      b: 3,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
      g: 7,
      aa: 11,
      bb: 22,
      cc: 33,
      dd: 44,
      ee: 55,
      aaa: 111,
      bbb: 222,
      ccc: 333,
      ddd: 444,
      eee: 555,
    };

    const result = payloadStringify(payload, 10);

    expect(result).toEqual('{"a":2,"b":3,"c":3,"d":4,"e":5,"f":6,"g":7,"aa":11}');
  });

  test('payloadStringify -> Huge String', () => {
    const length = 100000;
    let payload = '';
    for (let i = 0; i < length; i++) {
      payload += 'x';
    }

    const result = payloadStringify(payload, 10);

    expect(result).toEqual('"xxxxxxxxxx"...[too long]');
    expect(result.length).toEqual(25);
  });

  test('payloadStringify -> circular object', () => {
    let a = {};
    const payload = { a };
    payload.a = a;

    const result = payloadStringify(payload, 10);

    expect(result).toEqual('{"a":{}}');
  });

  test('payloadStringify -> circular inside array', () => {
    const dummy = {};
    const circular = { dummy };
    dummy['circular'] = circular;

    const payload = { a: [circular, 2] };

    const result = payloadStringify(payload, 10);

    expect(result).toEqual('{"a":[{"dummy":{}},2]}');
  });

  test('payloadStringify -> circular -> inherited property', function() {
    function Base() {
      this.base = true;
    }
    function Child() {
      this.child = true;
    }
    Child.prototype = new Base();

    const result = payloadStringify(new Child());

    expect(result).toEqual('{"child":true}');
  });

  test('keyToOmitRegexes', () => {
    process.env[LUMIGO_SECRET_MASKING_REGEX] = ['[".*evilPlan.*"]'];
    expect(keyToOmitRegexes().map(p => String(p))).toEqual(['/.*evilPlan.*/i']);
    process.env[LUMIGO_SECRET_MASKING_REGEX] = undefined;
    process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP] = ['[".*evilPlan2.*"]'];
    expect(keyToOmitRegexes().map(p => String(p))).toEqual(['/.*evilPlan2.*/i']);
    process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP] = undefined;
  });
});
