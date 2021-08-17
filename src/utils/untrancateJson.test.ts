import untruncateJson from './untrancateJson';

describe('untruncateJson', () => {
  it('returns unmodified valid string', () => {
    expectUnchanged('"Hello"');
  });

  it('returns unmodified valid string with bracket characters', () => {
    expectUnchanged('"}{]["');
  });

  it('returns unmodified valid string with escaped quotes', () => {
    expectUnchanged('"\\"Dr.\\" Leo Spaceman"');
  });

  it('returns unmodified valid string with Unicode escapes', () => {
    expectUnchanged('ab\\u0065cd');
  });

  it('returns unmodified valid number', () => {
    expectUnchanged('20');
  });

  it('returns unmodified valid boolean', () => {
    expectUnchanged('true');
    expectUnchanged('false');
  });

  it('returns unmodified valid null', () => {
    expectUnchanged('null');
  });

  it('returns unmodified valid array', () => {
    expectUnchanged('[]');
    expectUnchanged('["a", "b", "c"]');
    expectUnchanged('[ 1, 2, 3 ]');
  });

  it('returns unmodified valid object', () => {
    expectUnchanged('{}');
    expectUnchanged('{"foo": "bar"}');
    expectUnchanged('{ "foo": 2 }');
  });

  it('returns unmodified compound object', () => {
    expectUnchanged(
      JSON.stringify({
        s: 'Hello',
        num: 10,
        b: true,
        nul: 'null',
        o: { s: 'Hello2', num: 11 },
        a: ['Hello', 10, { s: 'Hello3' }],
      })
    );
  });

  it('adds a missing close quote', () => {
    expect(untruncateJson('"Hello')).toBe('"Hello"');
  });

  it('cuts off trailing "\\" in a string', () => {
    expect(untruncateJson('"Hello\\')).toBe('"Hello"');
  });

  it('cuts off a partial Unicode escape in a string', () => {
    expect(untruncateJson('"ab\\u006')).toBe('"ab"');
  });

  it('adds "0" to a number cut off at a negative sign', () => {
    expect(untruncateJson('-')).toBe('-0');
  });

  it('adds "0" to a number cut off at a decimal point', () => {
    expect(untruncateJson('12.')).toBe('12.0');
  });

  it('adds "0" to a number cut off at an "e" or "E"', () => {
    expect(untruncateJson('12e')).toBe('12e0');
    expect(untruncateJson('12E')).toBe('12E0');
  });

  it('adds "0" to a number cut off after "e+" or "e-"', () => {
    expect(untruncateJson('12e+')).toBe('12e+0');
    expect(untruncateJson('12E-')).toBe('12E-0');
  });

  it('adds "0" to a number cut off after "e" or "e"', () => {
    expect(untruncateJson('12ee')).toBe('12ee');
    expect(untruncateJson('12EE')).toBe('12EE');
  });

  it('completes boolean and null literals', () => {
    expect(untruncateJson('tr')).toBe('true');
    expect(untruncateJson('fal')).toBe('false');
    expect(untruncateJson('nu')).toBe('null');
  });

  it('closes an empty list', () => {
    expect(untruncateJson('[')).toBe('[]');
  });

  it('closes a list with items', () => {
    expect(untruncateJson('["a", "b"')).toBe('["a", "b"]');
  });

  it('closes a list ending in a number', () => {
    expect(untruncateJson('[1, 2')).toBe('[1, 2]');
  });

  it('completes boolean and null literals at the end of a list', () => {
    expect(untruncateJson('[tr')).toBe('[true]');
    expect(untruncateJson('[true, fa')).toBe('[true, false]');
    expect(untruncateJson('[nul')).toBe('[null]');
  });

  it('removes a trailing comma to end a list', () => {
    expect(untruncateJson('[1, 2,')).toBe('[1, 2]');
  });

  it('closes an empty object', () => {
    expect(untruncateJson('{')).toBe('{}');
  });

  it('closes an object after key-value pairs', () => {
    expect(untruncateJson('{"a": "b"')).toBe('{"a": "b"}');
    expect(untruncateJson('{"a": 1')).toBe('{"a": 1}');
  });

  it('cuts off a partial key in an object', () => {
    expect(untruncateJson('{"hel')).toBe('{}');
    expect(untruncateJson('{"hello": 1, "wo')).toBe('{"hello": 1}');
  });

  it('cuts off a key missing a colon in an object', () => {
    expect(untruncateJson('{"hello"')).toBe('{}');
    expect(untruncateJson('{"hello": 1, "world"')).toBe('{"hello": 1}');
  });

  it('cuts off a key and colon without a value in an object', () => {
    expect(untruncateJson('{"hello":')).toBe('{}');
    expect(untruncateJson('{"hello": 1, "world": ')).toBe('{"hello": 1}');
  });

  it('untruncates a value in an object', () => {
    expect(untruncateJson('{"hello": "wo')).toBe('{"hello": "wo"}');
    expect(untruncateJson('{"hello": [1, 2')).toBe('{"hello": [1, 2]}');
  });

  it('handles a string in an array cut off at a "\\"', () => {
    expect(untruncateJson('["hello\\')).toBe('["hello"]');
    expect(untruncateJson('["hello", "world\\')).toBe('["hello", "world"]');
  });

  it('handles a cut off string in an array with an escaped character', () => {
    expect(untruncateJson('["hello", "\\"Dr.]\\" Leo Spaceman')).toBe(
      '["hello", "\\"Dr.]\\" Leo Spaceman"]'
    );
  });

  it('handles a string in an object key cut off at a "\\"', () => {
    expect(untruncateJson('{"hello\\')).toBe('{}');
    expect(untruncateJson('{"hello": 1, "world\\')).toBe('{"hello": 1}');
  });

  it('removes cut off object with key containing escaped characters', () => {
    expect(untruncateJson('{"hello\\nworld": ')).toBe('{}');
    expect(untruncateJson('{"hello": 1, "hello\\nworld')).toBe('{"hello": 1}');
  });

  it('should produce valid JSON wherever the truncation occurs', () => {
    const json = `{
    "ab\\nc\\u0065d": ["ab\\nc\\u0065d", true, false, null, -12.3e-4],
    "": { "12": "ab\\nc\\u0065d"}
}  `;
    for (let i = 1, { length } = json; i < length; i++) {
      const partialJson = json.slice(0, i);
      const fixedJson = untruncateJson(partialJson);
      JSON.parse(fixedJson);
    }
  });

  function expectUnchanged(json: string) {
    expect(untruncateJson(json)).toBe(json);
  }
});
