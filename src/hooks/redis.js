import { safeRequire } from '../utils/requireUtils';
import { hook } from '../extender';
import { getRandomId } from '../utils';
import { createRedisSpan, extendRedisSpan } from '../spans/redisSpan';
import { SpansContainer } from '../globals';
import * as logger from '../logger';

const createCallbackHandler = redisSpan => args => {
  const ended = new Date();
  const [error, result] = args;
  const span = extendRedisSpan(redisSpan, {
    ended,
    error,
    result,
  });
  SpansContainer.addSpan(span);
};

function sendCommandBeforeHook(args) {
  const command = args[0];
  if (
    this.ready === false ||
    (this.stream && this.stream.writable === false) ||
    command.command === 'info'
  ) {
    // We skip this cases
    return;
  }
  const spanId = getRandomId();
  const started = new Date();

  const span = createRedisSpan(
    spanId,
    { started },
    {
      command: command.command,
      connectionOptions: this.connection_options,
    }
  );
  SpansContainer.addSpan(span);

  hook(command, 'callback', {
    beforeHook: createCallbackHandler(span),
  });
}

export const hookRedis = redisLib => {
  const redis = redisLib || safeRequire('redis');
  if (redis) {
    logger.info('Starting to instrument Redis');
    hook(redis.RedisClient.prototype, 'internal_send_command', {
      beforeHook: sendCommandBeforeHook,
    });
  }
};
