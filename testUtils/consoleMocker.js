export const ConsoleWritesForTesting = (() => {
  let logs = [];

  const addLog = (msg, obj) => {
    logs.push({ msg, obj });
  };

  const getLogs = () => logs;
  return { addLog, getLogs };
})();

export const ConsoleMocker = (() => {
  const log = ConsoleWritesForTesting.addLog;
  return { log };
})();
