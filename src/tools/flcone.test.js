'use strict';

import { fclone } from './fclone';

describe('fclone', function() {
  let input, output;

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
    input = a;
  });

  describe('will clone', function() {
    it('a string', function() {
      let i = '';
      let o = fclone(i);
      expect(o).toEqual(i);
    });

    it('an object', function() {
      let t = { foo: 'bar', bar: 'foo' };
      let o = fclone(t);

      delete t.foo;

      expect(t.foo).toBe(undefined);
      expect(o.foo).toEqual('bar');
    });

    it('a Buffer', function() {
      let a = new Buffer('this is a test');
      let b = fclone(a);
      expect(a.toString()).toEqual(b.toString());
    });

    it('a Date', function() {
      let a = new Date();
      let b = fclone(a);
      expect(a).toEqual(b);
    });

    it("an Error's properties", function() {
      let a = new Error('this is a test');
      let b = fclone(a);

      expect(a).not.toEqual(b);
      expect(b).toHaveProperty('name', a.name);
      expect(b).toHaveProperty('message', a.message);
      expect(b).toHaveProperty('stack', a.stack);
    });

    it('an inherited property', function() {
      function Base() {
        this.base = true;
      }
      function Child() {
        this.child = true;
      }
      Child.prototype = new Base();

      let z = fclone(new Child());
      expect(z).toHaveProperty('child', true);
      expect(z).not.toHaveProperty('base');
    });

    it('an Uint8Array', function() {
      // eslint-disable-next-line no-undef
      let t = new Uint8Array(3);
      [0, 1, 2].map(function(e) {
        t[e] = 0;
      });

      let o = fclone(t);

      // eslint-disable-next-line no-undef
      expect(o).toBeInstanceOf(Uint8Array);
      expect(o.length).toBe(3);
    });

    it('an array-like object', function() {
      let t = { length: 3, 0: 'test', 1: 'test', 2: 'test' };

      let o = fclone(t);

      expect(o).toEqual(t);
    });

    it('a uint8array like', function() {
      let t = {
        subarray: function() {
          return 'fail';
        },
      };
      let o = fclone(t);

      expect(o).not.toEqual('fail');
      expect(o.subarray()).toEqual('fail');
    });
  });

  describe('will not fclone circular data', function() {
    beforeEach(function() {
      output = fclone(input);
    });

    it('base object', function() {
      expect(output).toHaveProperty('a', '[Circular]');
      expect(output).toHaveProperty('b');
      expect(output).toHaveProperty('x', 1);
      expect(output).toHaveProperty('c');
    });

    it('nested property', function() {
      expect(output.b).toExist;
      expect(output.b).toHaveProperty('a', '[Circular]');
      expect(output.b).toHaveProperty('b', '[Circular]');
      expect(output.b).toHaveProperty('x', 2);
    });

    it('secondary nested property', function() {
      expect(output.c).toExist;
      expect(output.c).not.toHaveProperty('a');
      expect(output.c).toHaveProperty('b');
      expect(output.c).toHaveProperty('c', '[Circular]');
      expect(output.c.b).toEqual({
        a: '[Circular]',
        b: '[Circular]',
        x: 2,
      });
      expect(output.c).toHaveProperty('x', 3);
    });
  });
});
