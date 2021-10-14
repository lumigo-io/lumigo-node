import { GlobalDurationTimer } from './globalDurationTimer';

describe('GlobalDurationTimer', () => {
  function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  test('GlobalDurationTimer => simple flow', async () => {
    GlobalDurationTimer.start();
    await timeout(10);
    GlobalDurationTimer.stop();
    await timeout(10);
    GlobalDurationTimer.start();
    await timeout(10);
    GlobalDurationTimer.stop();

    expect(GlobalDurationTimer.isTimePassed(1000)).toBeFalsy();
    expect(GlobalDurationTimer.isTimePassed(10)).toBeTruthy();
    expect(GlobalDurationTimer.isTimePassed()).toBeFalsy();
  });

  test('@timedAsync => simple flow', async () => {
    class A {
      @GlobalDurationTimer.timedAsync()
      async a() {
        await timeout(10);
      }
    }
    const a = new A();
    await a.a();
    await timeout(10);
    await a.a();
    expect(GlobalDurationTimer.isTimePassed(1000)).toBeFalsy();
    expect(GlobalDurationTimer.isTimePassed(10)).toBeTruthy();
  });

  test('@timedSync => simple flow', () => {
    class A {
      @GlobalDurationTimer.timedSync()
      a() {
        for (let i = 0; i < 10000000; i++) {
          // eslint-disable-next-line no-console
          console.log(i);
        }
      }
    }
    const a = new A();
    a.a();
    expect(GlobalDurationTimer.isTimePassed(50000)).toBeFalsy();
    expect(GlobalDurationTimer.isTimePassed(1)).toBeTruthy();
  });
});
