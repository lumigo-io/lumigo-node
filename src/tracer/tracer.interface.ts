import type { Handler } from 'aws-lambda';

import { ExecutionTags } from '../globals';
import * as LumigoLogger from '../lumigoLogger';

export interface Tracer {
  trace: (handler: Handler) => Handler;
  addExecutionTag: typeof ExecutionTags.addTag;
  info: typeof LumigoLogger.info;
  warn: typeof LumigoLogger.warn;
  error: typeof LumigoLogger.error;
}
