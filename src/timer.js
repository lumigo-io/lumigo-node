/* eslint-disable no-console */
export const TracerTimer = (() => {
  let activeTimers = {};
  let results = {};

  const arrSum = arr => arr.reduce((a, b) => a + b, 0);
  const arrAvg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const arrCount = arr => arr.length;
  const arrMax = arr => Math.max(...arr);
  const arrMin = arr => Math.min(...arr);

  const getKey = (title, key) => `${title}#${key}`;

  const startJob = (title, key = 'main') => {
    const timerKey = getKey(title, key);
    activeTimers[timerKey] = new Date();
  };

  const endJob = (title, key = 'main') => {
    const timerKey = getKey(title, key);
    const jobTime = new Date() - activeTimers[timerKey];
    if (!results[title]) {
      results[title] = [];
    }
    results[title].push(jobTime);
  };

  const printResult = () => {
    // eslint-disable-next-line no-console
    Object.entries(results).forEach(([key, value]) => {
      console.log(key, {
        sum: arrSum(value),
        avg: arrAvg(value),
        count: arrCount(value),
        max: arrMax(value),
        min: arrMin(value),
      });
    });
  };

  return { startJob, endJob, printResult };
})();
