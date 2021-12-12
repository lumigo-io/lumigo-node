import { payloadStringify, keyToOmitRegexes, prune } from './payloadStringify';
import {
  LUMIGO_SECRET_MASKING_REGEX,
  LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP,
  LUMIGO_WHITELIST_KEYS_REGEXES,
} from '../utils';

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

    expect(result).toEqual('{"a":2,"b":3,"c":3,"d":4,"e":5,"f":6,"g":7,"aa":11}...[too long]');
  });

  test('payloadStringify -> prune after 10B -> list', () => {
    const payload = [2, 3, 3, 4, 5, 6, 7, 11, 22, 33, 44, 55, 111, 222, 333, 444, 555];

    const result = payloadStringify(payload, 10);

    expect(result).toEqual('[2,3,3,4,5,6,7,11]...[too long]');
  });

  test('prune on non-string', () => {
    const payload = { an: 'object' };

    const result = prune(payload, 10);

    expect(result).toEqual('');
  });

  test('prune on undefined', () => {
    const result = prune(undefined, 10);

    expect(result).toEqual('');
  });

  test('prune on null', () => {
    const result = prune(null, 10);

    expect(result).toEqual('');
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

    expect(result).toEqual('{"a":[{"dummy":{}},2]}...[too long]');
  });

  test('payloadStringify -> circular -> inherited property', function () {
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

  test('payloadStringify -> exception', function () {
    const error = new Error('SomeRandomError');
    const result = payloadStringify(error);

    const resultAsObject = JSON.parse(result);
    expect(resultAsObject.message).toEqual('SomeRandomError');
    expect(resultAsObject.stack.length).toBeGreaterThan(0);
  });

  test('keyToOmitRegexes', () => {
    process.env[LUMIGO_SECRET_MASKING_REGEX] = ['[".*evilPlan.*"]'];
    expect(keyToOmitRegexes().map((p) => String(p))).toEqual(['/.*evilPlan.*/i']);
    process.env[LUMIGO_SECRET_MASKING_REGEX] = undefined;
    process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP] = ['[".*evilPlan2.*"]'];
    expect(keyToOmitRegexes().map((p) => String(p))).toEqual(['/.*evilPlan2.*/i']);
    process.env[LUMIGO_SECRET_MASKING_REGEX_BACKWARD_COMP] = undefined;
  });

  test('payloadStringify -> skipScrubPath -> Not nested', () => {
    const payload = { Key: 'value' };
    const result = payloadStringify(payload, 1024, ['Key']);
    expect(result).toEqual(JSON.stringify(payload));
  });

  test('payloadStringify -> skipScrubPath -> Nested with array', () => {
    const payload = { Records: [{ object: { key: 'value' } }, { object: { key: 'value' } }] };
    const result = payloadStringify(payload, 1024, ['Records', [], 'object', 'key']);
    expect(result).toEqual(JSON.stringify(payload));
  });

  test('payloadStringify -> skipScrubPath -> Doesnt affect other paths', () => {
    const result = payloadStringify({ o: { key: 'value', password: 'value' } }, 1024, ['o', 'key']);
    expect(result).toEqual(JSON.stringify({ o: { key: 'value', password: '****' } }));
  });

  test('payloadStringify -> shoudnt scrub whitelist keys', () => {
    process.env[LUMIGO_WHITELIST_KEYS_REGEXES] = '[".*KeyConditionExpression.*", ".*ExclusiveStartKey.*"]';
    const result = payloadStringify(
      { ExclusiveStartKey: 'value', KeyConditionExpression: 'value' },
      1024
    );
    expect(result).toEqual(
      JSON.stringify({ ExclusiveStartKey: 'value', KeyConditionExpression: 'value' })
    );
  });

  test('payloadStringify -> skipScrubPath -> Nested items arent affected', () => {
    const result = payloadStringify({ o: { key: { password: 'value' } } }, 1024, ['o', 'key']);
    expect(result).toEqual(JSON.stringify({ o: { key: { password: '****' } } }));
  });

  test('payloadStringify -> skipScrubPath -> Affect only the full path', () => {
    const result = payloadStringify({ a: { key: 'c' } }, 1024, ['key']);
    expect(result).toEqual(JSON.stringify({ a: { key: '****' } }));
  });

  test('payloadStringify -> skipScrubPath -> Path doesnt exist', () => {
    const result = payloadStringify({ a: { key: 'c' } }, 1024, ['b', 'key']);
    expect(result).toEqual(JSON.stringify({ a: { key: '****' } }));
  });

  test('payloadStringify -> skipScrubPath -> Catch exception', () => {
    const skipPathWithError = ['a', 'key'];
    skipPathWithError.slice = () => {
      throw Error('ERROR');
    };
    const result = payloadStringify({ a: { key: 'c' } }, 1024, skipPathWithError);
    expect(result).toEqual(JSON.stringify({ a: { key: '****' } }));
  });

  test('payloadStringify -> skipScrubPath empty array -> Do nothing', () => {
    const result = payloadStringify({ a: { key: 'c' } }, 1024, []);
    expect(result).toEqual(JSON.stringify({ a: { key: '****' } }));
  });
});
