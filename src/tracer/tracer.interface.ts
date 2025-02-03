import type { Callback, Context, Handler } from 'aws-lambda';

import { ExecutionTags } from '../globals';
import * as LumigoLogger from '../lumigoLogger';

export type ResponseStreamHandler<TEvent = any, TResult = any> = (
  event: TEvent,
  responseStream: any,
  context: Context,
  callback?: Callback<TResult>
) => void | Promise<TResult>;

export interface Tracer {
  trace<T extends Handler | ResponseStreamHandler>(handler: T): T;
  addExecutionTag: typeof ExecutionTags.addTag;
  info: typeof LumigoLogger.info;
  warn: typeof LumigoLogger.warn;
  error: typeof LumigoLogger.error;
}
