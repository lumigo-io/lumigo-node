export const ConsoleWritesForTesting = (() => {
  let logs = [];

  const addLog = (msg, obj) => {
    logs.push({ msg, obj });
  };

  const getLogs = () => logs;

  const clean = () => {
    logs = [];
  };

  return { addLog, getLogs, clean };
})();

export const ConsoleMocker = (() => {
  const log = ConsoleWritesForTesting.addLog;
  const info = ConsoleWritesForTesting.addLog;
  const debug = ConsoleWritesForTesting.addLog;
  const warn = ConsoleWritesForTesting.addLog;
  const error = ConsoleWritesForTesting.addLog;
  return { log, info, warn, error, debug };
})();
