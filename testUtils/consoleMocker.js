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
  return { log };
})();
