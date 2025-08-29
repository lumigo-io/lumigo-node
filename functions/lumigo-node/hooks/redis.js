import { safeRequire } from '../utils/requireUtils';
import { hook, hookPromise } from '../extender';
import { getRandomId } from '../utils';
import { createRedisSpan, extendRedisSpan } from '../spans/redisSpan';
import { SpansContainer, TracerGlobals } from '../globals';
import * as logger from '../logger';
import { getCurrentTransactionId } from '../spans/awsSpan';
const handleResult = (currentSpan, result, error) => {
    const ended = Date.now();
    const span = extendRedisSpan(currentSpan, {
        ended,
        error,
        result,
    });
    SpansContainer.addSpan(span);
};
const createCallbackHandler = (redisSpan) => (args) => {
    const [error, result] = args;
    handleResult(redisSpan, result, error);
};
function sendCommandBeforeHook(args) {
    const { awsRequestId } = TracerGlobals.getHandlerInputs().context;
    const transactionId = getCurrentTransactionId();
    const command = args[0];
    if (this.ready === false ||
        (this.stream && this.stream.writable === false) ||
        command.command === 'info') {
        // We skip this cases
        return;
    }
    const spanId = getRandomId();
    const started = Date.now();
    const span = createRedisSpan(transactionId, awsRequestId, spanId, { started }, {
        command: command,
        connectionOptions: this.connection_options,
    });
    SpansContainer.addSpan(span);
    if (command.callback) {
        hook(command, 'callback', {
            beforeHook: createCallbackHandler(span),
        });
    }
    // ioredis
    if (command.promise) {
        hookPromise(command.promise, {
            thenHandler: (args) => {
                handleResult(span, args);
            },
            catchHandler: (args) => {
                handleResult(span, null, args);
            },
        });
    }
}
export const hookRedis = (redisLib) => {
    var _a;
    const redis = redisLib || safeRequire('redis');
    if (redis && redis.RedisClient) {
        logger.info('Starting to instrument Redis');
        hook(redis.RedisClient.prototype, 'internal_send_command', {
            beforeHook: sendCommandBeforeHook,
        });
    }
    const ioredis = redisLib || safeRequire('ioredis');
    if (ioredis && ((_a = ioredis.prototype) === null || _a === void 0 ? void 0 : _a.sendCommand)) {
        logger.info('Starting to instrument ioredis');
        hook(ioredis.prototype, 'sendCommand', {
            beforeHook: sendCommandBeforeHook,
        });
    }
};
