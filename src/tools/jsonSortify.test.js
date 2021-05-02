import { sortify } from './jsonSortify';
JSON.sortify = sortify;
describe('JSON.sortify', function () {
  describe('interface', function () {
    it('should define a function', function () {
      expect(typeof JSON.sortify).toBe('function');
    });

    it('should take precisely three arguments', function () {
      expect(JSON.sortify.length).toBe(3);
    });
  });

  describe('compatibility', function () {
    it('should stringify simple values', function () {
      var fixtures = [
        1,
        0.234,
        Infinity,
        NaN,
        null,
        true,
        false,
        undefined,
        'undefined',
        '',
        function bar() {},
        /abc/,
      ];
      if (typeof global.Symbol !== 'undefined') {
        //eslint-disable-next-line no-undef
        fixtures.push(Symbol());
      }
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture)).toEqual(JSON.stringify(fixture));
      });
    });

    it('should stringify simple objects', function () {
      var fixtures = [
        { a: 1, b: true, c: 'ok', d: null },
        { a: 0.1, b: undefined, c: function () {} },
        '{"a":0.1}',
        { ' ': '"', null: 'null', undefined: '\t' },
        { '"\n\t\\:': '' },
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture)).toEqual(JSON.stringify(fixture));
      });
    });

    it('should stringify simple arrays', function () {
      var fixtures = [
        [1, true, 'ok', null],
        [0.1, undefined, function () {}],
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture)).toEqual(JSON.stringify(fixture));
      });
    });

    it('should stringify nested objects', function () {
      var fixtures = [
        { a: { b: 2, c: { d: 3 } } },
        [{ a: { b: 1 }, b: [{ a: 1 }, { b: { c: [2, null] } }] }],
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture)).toEqual(JSON.stringify(fixture));
      });
    });

    it('should handle toJSON', function () {
      var fixtures = [
        {
          toJSON: function () {
            return 'Banana!';
          },
        },
        {
          a: 1,
          b: 2,
          toJSON: function () {
            return null;
          },
        },
        {
          a: {
            b: 1,
            toJSON: function () {
              return 'x';
            },
          },
          c: 3,
        },
        {
          a: {
            b: 1,
            toJSON: function (key) {
              return 'x' + key + 'y';
            },
          },
        },
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture)).toEqual(JSON.stringify(fixture));
      });
    });

    it('should handle the replacer parameter', function () {
      var fixtures = [
        [{ a: { b: 2, c: { d: 3 } } }, ['a']],
        [{ a: { b: 2, c: { d: 3 } } }, ['b']],
        [{ a: { b: 2, c: { d: 3 } } }, []],
        [{ a: { b: 2, a: { a: 3, c: 2 } } }, ['a']],
        [
          { a: 1, b: 'foo' },
          function (key, value) {
            return typeof value == 'string' ? value + '!!!' : value;
          },
        ],
        [{ a: { b: 2, a: { a: 3, c: 2 } } }, function () {}],
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture[0], fixture[1])).toEqual(
          JSON.stringify(fixture[0], fixture[1])
        );
      });
    });

    it('should handle the indentation parameter', function () {
      var fixtures = [
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, null],
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, 1],
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, 4],
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, 11],
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, -1],
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, '\t'],
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, 'garbage'],
        [{ a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } }, 'too long, must be shortened'],
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture[0], null, fixture[1])).toEqual(
          JSON.stringify(fixture[0], null, fixture[1])
        );
      });
    });

    it('should handle three arguments', function () {
      var fixtures = [
        [
          { a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } },
          function (key, value) {
            return typeof value == 'string' ? value + '!!!' : value;
          },
          4,
        ],
        [{ a: { a: 2, c: [{ d: 3 }, 4, 'hello'] } }, ['a'], '\t'],
        [
          { a: { b: 2, c: [{ d: 3 }, 4, 'hello'] } },
          function (key, value) {
            return value;
          },
          'garbage ',
        ],
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify.apply(JSON, fixture)).toEqual(JSON.stringify.apply(JSON, fixture));
      });
    });

    it('should throw a TypeError on cyclic values', function () {
      var fixtures = [{}, { a: {} }, [], { a: [] }, { a: [] }];
      fixtures[0].x = fixtures[0];
      fixtures[1].a.b = fixtures[1];
      fixtures[2].push(fixtures[2]);
      fixtures[3].a.push(fixtures[3]);
      fixtures[4].a.push(fixtures[4].a);
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify.bind(JSON, fixture)).toThrow(TypeError);
      });
    });
  });

  describe('sortification', function () {
    it('should sort keys', function () {
      var fixtures = [
        [{ c: 1, b: 2, a: 3 }, '{"a":3,"b":2,"c":1}'],
        [
          { c: 1, 42: 2, a: 3, 0: 4, '': 5, '00': 6, 5: 7 },
          '{"0":4,"5":7,"42":2,"":5,"00":6,"a":3,"c":1}',
        ],
        [{ c: 1, b: 2, a: { y: 1, z: 2, x: 3 } }, '{"a":{"x":3,"y":1,"z":2},"b":2,"c":1}'],
        [
          { c: 1, b: ['foo', 2, { a: { y: 1, z: 2, x: 3 } }] },
          '{"b":["foo",2,{"a":{"x":3,"y":1,"z":2}}],"c":1}',
        ],
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture[0])).toEqual(fixture[1]);
      });
    });

    it('should sort keys and handle three arguments', function () {
      var fixtures = [
        [{ x: 1, b: 2, a: 3 }, ['a', 'b', 'c'], 2, '{\n  "a": 3,\n  "b": 2\n}'],
        [
          {
            x: 1,
            b: {
              toJSON: function () {
                return 'b';
              },
            },
            a: 3,
          },
          ['a', 'b', 'c'],
          '••',
          '{\n••"a": 3,\n••"b": "b"\n}',
        ],
        [
          {
            a: undefined,
            b: function () {},
            x: 1,
            c: 2,
            0: 3,
            5: 5,
            11: 11,
            ' d ': 5,
            z: 'foo',
            aa: 'a',
            d: [{ f: { h: 2, e: 1 } }, null, '2'],
          },
          function (key, val) {
            return typeof val == 'string' ? val + '!!!' : val;
          },
          4,
          '{\n    "0": 3,\n    "5": 5,\n    "11": 11,\n    " d ": 5,\n    "aa": "a!!!",\n    "c": 2,\n    "d": [\n        {\n            "f": {\n                "e": 1,\n                "h": 2\n            }\n        },\n        null,\n        "2!!!"\n    ],\n    "x": 1,\n    "z": "foo!!!"\n}',
        ],
      ];
      fixtures.forEach(function (fixture) {
        expect(JSON.sortify(fixture[0], fixture[1], fixture[2])).toEqual(fixture[3]);
      });
    });
  });

  describe('interoperability / interchangeability', function () {
    var fixtures = [
      1,
      [1, { a: 1, b: 2, c: [1, 2] }],
      {
        a: {
          b: 1,
          toJSON: function (key) {
            return 'x' + key + 'y';
          },
        },
      },
    ];
    it('should not depend on the “JSON” scope', function () {
      var jsonSortify = JSON.sortify;
      fixtures.forEach(function (fixture) {
        expect(jsonSortify(fixture)).toEqual(JSON.stringify(fixture));
      });
    });
    it('should allow to overwrite “JSON.stringify”', function () {
      var jsonStringifyOriginal = JSON.stringify.bind(JSON);
      JSON.stringify = JSON.sortify;
      fixtures.forEach(function (fixture) {
        expect(JSON.stringify(fixture)).toEqual(jsonStringifyOriginal(fixture));
      });
    });
  });
});
