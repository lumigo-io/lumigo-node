import type { TracerOptions } from './tracer-options.interface';

export type TraceOptions = Pick<
  TracerOptions,
  'token' | 'debug' | 'edgeHost' | 'switchOff' | 'stepFunction'
>;
