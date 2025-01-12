import type { Callback, Context, Handler } from 'aws-lambda';

import { ExecutionTags } from '../globals';
import * as LumigoLogger from '../lumigoLogger';

export interface ResponseStream {
  write(data: string | Buffer): void;
  end(data?: string | Buffer): void;
  setContentType(contentType: string): void;
}

export type ResponseStreamHandler<TEvent = any, TResult = any> = (
  event: TEvent,
  responseStream: ResponseStream,
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
