import { createMockedClient } from '../../testUtils/redisMocker';
import { SpansContainer, TracerGlobals } from '../globals';
import { hookRedis } from './redis';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';
import { RedisSpanBuilder } from '../../testUtils/redisSpanBuilder';
import { createRedisSpan } from '../spans/redisSpan';

const noop = () => {};

const dummyConnectionOptions = {
  host: 'tracer-test-cluster.1meza6.ng.0001.usw1.cache.amazonaws.com',
  port: '6379',
};

describe('redis', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hook redis -> simple flow', async () => {
    const redisClient = createMockedClient();
    hookRedis(redisClient);

    const client = redisClient.createClient(dummyConnectionOptions);

    client.set('Key', 'Value', noop);

    const spans = SpansContainer.getSpans();
    const expectedSpan = new RedisSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withConnectionOptions(dummyConnectionOptions)
      .withRequestCommand('set')
      .withRequestArgs('["Key","Value"]')
      .withResponse(`"OK"`)
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hook redis -> not ready', async () => {
    const redisClient = createMockedClient({ notReady: true });
    hookRedis(redisClient);

    const client = redisClient.createClient(dummyConnectionOptions);

    client.set('Key', 'Value', noop);

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([]);
  });

  test('hook redis -> with error', async () => {
    const redisClient = createMockedClient({ shouldFail: true });
    hookRedis(redisClient);

    const client = redisClient.createClient(dummyConnectionOptions);

    client.set('Key', 'Value', noop);

    const spans = SpansContainer.getSpans();
    const expectedSpan = new RedisSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withConnectionOptions(dummyConnectionOptions)
      .withRequestCommand('set')
      .withRequestArgs('["Key","Value"]')
      .withError(`"Bad data"`)
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('createRedisSpan -> empty', async () => {
    const result = createRedisSpan('123', { started: 123 }, {});
    expect(result.requestCommand).toBe(null);
    expect(result.requestArgs).toBe(null);
  });
});
