import {
  getDurationTimer,
  TracerTimers,
  GlobalDurationTimer,
  TracerTimer,
} from './globalDurationTimer';

describe('GlobalDurationTimer', () => {
  let timerA = getDurationTimer('timerA');
  let timerB = getDurationTimer('timerB');
  function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  test('GlobalDurationTimer => TracerTimers validate', async () => {
    expect(TracerTimers['timerA']).toEqual(timerA);
    expect(TracerTimers['global']).toEqual(GlobalDurationTimer);
  });

  const testTimer = async (timer: TracerTimer, time = 10) => {
    timer.start();
    await timeout(time);
    timer.stop();
    await timeout(time);
    timer.start();
    await timeout(time);
    timer.stop();

    expect(timer.isTimePassed(time * 4)).toBeFalsy();
    expect(timer.isTimePassed(time / 2)).toBeTruthy();
    expect(timer.isTimePassed()).toBeFalsy();
  };

  test('GlobalDurationTimer => simple flow (timerA)', async () => {
    await testTimer(timerA);
    await testTimer(timerB, 5);
    const timerADuration = TracerTimers['timerA'].getReport().duration;
    const timerBDuration = TracerTimers['timerB'].getReport().duration;
    expect(timerADuration).toBeGreaterThanOrEqual(20);
    expect(timerADuration).toBeLessThanOrEqual(30);
    expect(timerBDuration).toBeGreaterThanOrEqual(10);
    expect(timerBDuration).toBeLessThanOrEqual(20);
  });

  test('@timedAsync => simple flow', async () => {
    class A {
      @timerA.timedAsync()
      async a() {
        await timeout(10);
      }
    }
    const a = new A();
    await a.a();
    await timeout(10);
    await a.a();
    expect(timerA.isTimePassed(150)).toBeFalsy();
    expect(timerA.isTimePassed(10)).toBeTruthy();
  });

  test('@timedSync => simple flow', () => {
    class A {
      @timerA.timedSync()
      a() {
        for (let i = 0; i < 10000000; i++) {
          // eslint-disable-next-line no-console
          console.log(i);
        }
      }
    }
    const a = new A();
    a.a();
    expect(timerA.isTimePassed(50000)).toBeFalsy();
    expect(timerA.isTimePassed(1)).toBeTruthy();
  });
});
