'use strict';

import { noCirculars } from './noCirculars';

describe('noCirculars', function() {
  beforeEach(function() {
    let a = {};
    a.a = a;
    a.b = {};
    a.b.a = a;
    a.b.b = a.b;
    a.c = {};
    a.c.b = a.b;
    a.c.c = a.c;
    a.x = 1;
    a.b.x = 2;
    a.c.x = 3;
    a.d = [0, a, 1, a.b, 2, a.c, 3];
  });

  describe('will clone', function() {
    it('a string', function() {
      let i = '';
      let o = noCirculars(i);
      expect(o).toEqual(i);
    });

    it('an object', function() {
      let t = { foo: 'bar', bar: 'foo' };
      let o = noCirculars(t);

      delete t.foo;

      expect(t.foo).toBe(undefined);
      expect(o.foo).toEqual('bar');
    });

    it('Circular object', function() {
      let a = {};
      let b = { a };
      a.b = b;
      let c = noCirculars(a);
      expect(c).toEqual({
        b: {
          a: '[Circular]',
        },
      });
    });

    it('an inherited property', function() {
      function Base() {
        this.base = true;
      }
      function Child() {
        this.child = true;
      }
      Child.prototype = new Base();

      let z = noCirculars(new Child());
      expect(z).toHaveProperty('child', true);
      expect(z).not.toHaveProperty('base');
    });

    it('an array-like object', function() {
      let t = { length: 3, 0: 'test', 1: 'test', 2: 'test' };

      let o = noCirculars(t);

      expect(o).toEqual(t);
    });

    it('object with array', function() {
      let t = { a: [1, 2] };

      let o = noCirculars(t);

      expect(o).toEqual(t);
    });
  });
});
