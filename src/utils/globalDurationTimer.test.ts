import { GlobalDurationTimer, TracerTimer, DurationTimer } from './globalDurationTimer';

describe('GlobalDurationTimer', () => {
  let timerA = DurationTimer.getDurationTimer('timerA');
  let timerB = DurationTimer.getDurationTimer('timerB');
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  test('GlobalDurationTimer => TracerTimers validate', async () => {
    expect(DurationTimer.getTimers()['timerA']).toEqual(timerA);
    expect(DurationTimer.getTimers()['timerB']).toEqual(timerB);
    expect(DurationTimer.getTimers()['global']).toEqual(GlobalDurationTimer);
  });

  const testTimer = async (timer: TracerTimer, name: string, time = 10) => {
    // FIRST
    timer.start();
    await wait(time);
    timer.stop();

    // WAIT NO TIMING
    await wait(time);

    // SECOND
    timer.start();
    await wait(time);
    timer.stop();

    // WAIT NO TIMING
    await wait(time);

    //THIRD
    timer.start();
    await wait(time);
    timer.stop();

    const timerReport = DurationTimer.getTimers()[name].getReport();
    expect(timerReport.duration).toBeGreaterThanOrEqual(time * 3);
    expect(timerReport.duration).toBeLessThanOrEqual(time * 3 + 20);
    expect(timer.isTimePassed(time * 3 + 20)).toBeFalsy();
    expect(timer.isTimePassed(time * 3 - 1)).toBeTruthy();
    expect(timer.isTimePassed()).toBeFalsy();
    return timerReport;
  };

  test('GlobalDurationTimer => simple flow (timerA, timerB)', async () => {
    const timerAReport = await testTimer(timerA, 'timerA', 60);
    const timerBReport = await testTimer(timerB, 'timerB', 30);
    const report = DurationTimer.generateTracerAnalyticsReport();
    expect(report[0]).toEqual({
      name: 'global',
      duration: 0,
    });
    expect(report[1]).toEqual(timerAReport);
    expect(report[2]).toEqual(timerBReport);
  });

  test('@timedAsync => simple flow', async () => {
    timerA.reset();
    expect(timerA.getReport().duration).toEqual(0);
    class A {
      @timerA.timedAsync()
      async a() {
        await wait(10);
      }
    }
    const a = new A();
    await a.a();
    await wait(10);
    await a.a();
    expect(timerA.isTimePassed(150)).toBeFalsy();
    expect(timerA.isTimePassed(10)).toBeTruthy();
  });

  test('@timedSync => simple flow', () => {
    timerA.reset();
    class A {
      @timerA.timedSync()
      a() {
        let x = 0;
        for (let i = 0; i < 10000000; i++) {
          // eslint-disable-next-line no-console
          x++;
        }
        return x;
      }
    }
    const a = new A();
    a.a();
    expect(timerA.isTimePassed(50000)).toBeFalsy();
    expect(timerA.isTimePassed(1)).toBeTruthy();
  });
});
