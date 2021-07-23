import { GlobalDurationTimer, TracerTimer, DurationTimer } from './globalDurationTimer';
import { sleep } from '../../testUtils/sleep';

describe('GlobalDurationTimer', () => {
  let timerA = DurationTimer.getDurationTimer('timerA');
  let timerB = DurationTimer.getDurationTimer('timerB');

  test('GlobalDurationTimer => TracerTimers validate', async () => {
    expect(DurationTimer.getTimers()['timerA']).toEqual(timerA);
    expect(DurationTimer.getTimers()['timerB']).toEqual(timerB);
    expect(DurationTimer.getTimers()['global']).toEqual(GlobalDurationTimer);
  });

  const expects = (name: string, greaterThan: number, lessThan: number) => {
    const timerReport = DurationTimer.getTimers()[name].getReport();
    expect(timerReport.duration).toBeGreaterThanOrEqual(greaterThan);
    expect(timerReport.duration).toBeLessThanOrEqual(lessThan);
  };

  const testTimer = async (timer: TracerTimer, name: string, time = 10) => {
    // FIRST
    timer.start();
    await sleep(time);
    timer.stop();
    expects(name, time - 1, time * 1.15);
    // WAIT NO TIMING
    await sleep(time);

    // SECOND
    timer.start();
    await sleep(time);
    timer.stop();
    expects(name, time * 2 - 1, time * 2.3);

    // WAIT NO TIMING
    await sleep(time);

    //THIRD
    timer.start();
    await sleep(time);
    timer.stop();
    expects(name, time * 3 - 1, time * 3.35);

    const timerReport = DurationTimer.getTimers()[name].getReport();
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
        await sleep(10);
      }
    }
    const a = new A();
    await a.a();
    await sleep(10);
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
