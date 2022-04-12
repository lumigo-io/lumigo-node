import type { Handler } from 'aws-lambda';

import { ExecutionTags } from '../globals';
import * as LumigoLogger from '../lumigoLogger';
import { ManualTracer } from '../utils/manualTracing';

export interface Tracer {
  trace: (handler: Handler) => Handler;
  startTrace: typeof ManualTracer.startTrace;
  stopTrace: typeof ManualTracer.stopTrace;
  traceAsync: typeof ManualTracer.traceAsync;
  traceSync: typeof ManualTracer.traceSync;
  addExecutionTag: typeof ExecutionTags.addTag;
  info: typeof LumigoLogger.info;
  warn: typeof LumigoLogger.warn;
  error: typeof LumigoLogger.error;
}
