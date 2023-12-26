import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { PrismaSpanBuilder } from '../../testUtils/prismaSpanBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { hookPrisma } from './prisma';

describe('Prisma', () => {
  let client;

  beforeAll(() => {
    const prismaClientLibrary = require('@prisma/client');
    hookPrisma(prismaClientLibrary);
    client = new prismaClientLibrary.PrismaClient();
  });

  afterAll(() => client.$disconnect());

  beforeEach(() => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
    SpansContainer.clearSpans();
  });

  test('simple operation', async () => {
    const count = await client.user.count();

    const spans = SpansContainer.getSpans();
    expect(spans).toHaveLength(1);

    const expectedSpan = new PrismaSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withModelName('User')
      .withOperation('count')
      .withQueryArgs({})
      .withResult(count.toString())
      .build();

    expect(spans[0]).toEqual(expectedSpan);
  });
});
