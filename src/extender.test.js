import * as extender from './extender';
import * as shimmer from 'shimmer';
import * as dummy from './extender.testModule';

export const DummyCounterService = (() => {
  let dummyCounter = 0;

  const incrementToDummyCounter = (count = 1) => {
    dummyCounter += count;
  };
  const incrementToDummyCounterMultipleParam = (count1 = 1, count2 = 1) => {
    dummyCounter += count1;
    dummyCounter += count2;
  };
  const getDummyCounter = () => dummyCounter;

  const raiseError = () => {
    throw new Error('ERROR');
  };
  const reset = () => {
    dummyCounter = 0;
  };
  return {
    incrementToDummyCounter,
    getDummyCounter,
    incrementToDummyCounterMultipleParam,
    raiseError,
    reset,
  };
})();

describe('extender', () => {
  beforeEach(() => {
    //clean all shimmers
    shimmer.unwrap(DummyCounterService, 'incrementToDummyCounter');
    shimmer.unwrap(DummyCounterService, 'incrementToDummyCounterMultipleParam');
    shimmer.unwrap(DummyCounterService, 'getDummyCounter');
    DummyCounterService.reset();
  });

  test('hook -> simple flow, empty before and after', () => {
    extender.hook(DummyCounterService, 'incrementToDummyCounter');
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
  });

  test('hook -> constructor flow', () => {
    expect(new dummy.DummyClass().value).toEqual(0);

    extender.hook(dummy, 'DummyClass', {
      isConstructor: true,
      afterHook: (args, clientInstance, extenderContext) => {
        clientInstance.value = 42;
      }
    });

    expect(new dummy.DummyClass().value).toEqual(42);
  });

  test('hook -> before Hook', () => {
    let beforeCounter = 0;
    extender.hook(DummyCounterService, 'incrementToDummyCounter', {
      beforeHook: () => {
        expect(DummyCounterService.getDummyCounter()).toEqual(0);
        beforeCounter++;
      },
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
    expect(beforeCounter).toEqual(1);
  });

  test('hook -> before Hook - multiple param', () => {
    let beforeCounter = 0;
    extender.hook(DummyCounterService, 'incrementToDummyCounterMultipleParam', {
      beforeHook: (args) => {
        expect(DummyCounterService.getDummyCounter()).toEqual(0);
        beforeCounter += args[0];
        beforeCounter += args[1];
      },
    });
    DummyCounterService.incrementToDummyCounterMultipleParam(5, 10);
    expect(DummyCounterService.getDummyCounter()).toEqual(15);
    expect(beforeCounter).toEqual(15);
  });

  test('hook -> after Hook', () => {
    let afterCounter = 0;
    extender.hook(DummyCounterService, 'incrementToDummyCounter', {
      afterHook: () => {
        expect(DummyCounterService.getDummyCounter()).toEqual(1);
        afterCounter++;
      },
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
    expect(afterCounter).toEqual(1);
  });

  test('hook -> before & after Hook', () => {
    let afterCounter = 0;
    let beforeCounter = 0;
    extender.hook(DummyCounterService, 'incrementToDummyCounter', {
      beforeHook: () => {
        expect(DummyCounterService.getDummyCounter()).toEqual(0);
        beforeCounter++;
      },
      afterHook: () => {
        expect(DummyCounterService.getDummyCounter()).toEqual(1);
        afterCounter++;
      },
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
    expect(afterCounter).toEqual(1);
    expect(beforeCounter).toEqual(1);
  });

  test('hook -> extenderContext', () => {
    let afterCounter = 0;
    let beforeCounter = 0;
    extender.hook(DummyCounterService, 'incrementToDummyCounter', {
      beforeHook: (args, extenderContext) => {
        expect(extenderContext).toEqual({});
        extenderContext.a = '1';
        beforeCounter++;
      },
      afterHook: (args, functionResult, extenderContext) => {
        expect(extenderContext).toEqual({ a: '1' });
        afterCounter++;
      },
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
    expect(afterCounter).toEqual(1);
    expect(beforeCounter).toEqual(1);
  });

  test('hook -> afterHook got return value', () => {
    let afterCounter = 0;
    let beforeCounter = 0;
    extender.hook(DummyCounterService, 'getDummyCounter', {
      beforeHook: (args, extenderContext) => {
        expect(extenderContext).toEqual({});
        extenderContext.a = '1';
        beforeCounter++;
      },
      afterHook: (args, functionResult) => {
        expect(functionResult).toEqual(1);
        afterCounter++;
      },
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
    expect(afterCounter).toEqual(1);
    expect(beforeCounter).toEqual(1);
  });

  test('hook -> return value', () => {
    let beforeCounter = 0;
    extender.hook(DummyCounterService, 'getDummyCounter', {
      beforeHook: () => {
        beforeCounter++;
      },
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
    expect(beforeCounter).toEqual(1);
  });

  test('hook -> safe mode - extenders', () => {
    extender.hook(DummyCounterService, 'incrementToDummyCounter', {
      beforeHook: () => {
        throw Error('ERROR');
      },
      afterHook: () => {
        throw Error('ERROR');
      },
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
  });

  test('hook -> multiple hooks', () => {
    let beforeCounter = 0;
    const beforeHandler = () => {
      beforeCounter++;
    };
    extender.hook(DummyCounterService, 'incrementToDummyCounter', {
      beforeHook: beforeHandler,
    });
    extender.hook(DummyCounterService, 'incrementToDummyCounter', {
      beforeHook: beforeHandler,
    });
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
    expect(beforeCounter).toEqual(1);
  });

  test('hook -> safe mode - shimmer', () => {
    const shimmerLib = {
      wrap: () => {
        throw new Error();
      },
    };

    extender.hook(DummyCounterService, 'incrementToDummyCounter', {}, shimmerLib);
    DummyCounterService.incrementToDummyCounter();
    expect(DummyCounterService.getDummyCounter()).toEqual(1);
  });

  test('hook -> client exception', (done) => {
    extender.hook(DummyCounterService, 'raiseError');
    try {
      DummyCounterService.raiseError();
    } catch (e) {
      expect(e.message).toEqual('ERROR');
      done();
    }
  });

  test('hookPromise -> thenHandler', (done) => {
    let resolveRef;

    const p = new Promise(function (resolve) {
      resolveRef = resolve;
    });

    const thenHandler = (value) => {
      expect(value).toEqual('Value');
      done();
    };
    extender.hookPromise(p, { thenHandler: thenHandler });
    resolveRef('Value');
  });

  test('hookPromise -> thenHandler -> safe from errors', async () => {
    let resolveRef;

    const p = new Promise(function (resolve) {
      resolveRef = resolve;
    });

    const thenHandler = (value) => {
      expect(value).toEqual('Value');
      throw new Error('Bla bla');
    };
    extender.hookPromise(p, { thenHandler: thenHandler });
    resolveRef('Value');
    await p;
  });

  test('hookPromise -> catchHandler', async () => {
    const p = Promise.reject(new Error('octopus'));

    const catchHandler = (value) => {
      expect(value).toEqual('octopus');
    };
    extender.hookPromise(p, { catchHandler: catchHandler });
    await expect(p).rejects.toThrow();
  });
});
