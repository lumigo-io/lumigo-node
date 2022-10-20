import EventEmitter from 'events';

export const MongoMockerEventEmitter = (() => {
  let eventEmitter = new EventEmitter();
  const getEventEmitter = () => eventEmitter;
  const cleanEventEmitter = () => {
    eventEmitter.eventNames().forEach((event) => {
      eventEmitter.removeAllListeners(event);
    });
  };
  return { getEventEmitter, cleanEventEmitter };
})();
