export type ManualTrace = {
  name: string;
  startTime: number;
  endTime?: number;
};

let closedManualTraces: ManualTrace[] = [];
// eslint-disable-next-line no-undef
const openManualTraces = new Map<string, ManualTrace>();

export class ManualTracer {
  static getTraces() {
    return [...closedManualTraces];
  }

  static clear() {
    openManualTraces.clear();
    closedManualTraces = [];
  }

  static startTrace = (name: string): void => {
    const tracerTimer: ManualTrace = {
      name,
      startTime: new Date().getTime(),
    };
    openManualTraces.set(name, tracerTimer);
  };

  static stopTrace = (name: string): void => {
    const trace = openManualTraces.get(name);
    trace.endTime = new Date().getTime();
    closedManualTraces.push(trace);
  };

  // eslint-disable-next-line no-undef
  static traceAsync(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      ManualTracer.startTrace(target.name);
      const result = await originalMethod.apply(target, args);
      ManualTracer.stopTrace(target.name);
      return result;
    };

    return descriptor;
  }

  // eslint-disable-next-line no-undef
  static traceSync(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      ManualTracer.startTrace(propertyKey);
      const result = originalMethod.apply(target, args);
      ManualTracer.stopTrace(propertyKey);
      return result;
    };
    return descriptor;
  }
}



