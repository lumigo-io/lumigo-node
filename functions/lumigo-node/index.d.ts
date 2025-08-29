import { Tracer, TracerOptions } from './tracer';
declare function initTracer(options?: TracerOptions): Tracer;
export { info, warn, error } from './lumigoLogger';
export default initTracer;
export declare const addExecutionTag: (key: any, value: any, shouldLogErrors?: boolean) => boolean;
export { initTracer };
export type { Tracer, TracerOptions };
