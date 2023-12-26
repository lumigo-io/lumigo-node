import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { PrismaSpanBuilder } from '../../testUtils/prismaSpanBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { hookPrisma } from './prisma';

describe('Prisma', () => {
  describe("bad Prisma versions", () => {
    afterEach(() => {
      // Reset overrides made to the prisma-client after require() in each test
      jest.resetModules()
    });

    let prismaClientLibrary

    beforeEach(() => {
      prismaClientLibrary = require('@prisma/client')
    });

    test('no $extends hook', async () => {
      // Override constructor
      prismaClientLibrary.PrismaClient = function () {
        return {
          '$extends': 'not-a-function'
        }
      }

      hookPrisma(prismaClientLibrary);

      expect(() => new prismaClientLibrary.PrismaClient()).not.toThrow()
    });

    test('no PrismaClient class', async () => {
      delete prismaClientLibrary.PrismaClient

      expect(() => hookPrisma(prismaClientLibrary)).not.toThrow()
    });
  })

  describe("supported Prisma versions", () => {
    let client;

    beforeAll(() => {
      const prismaClientLibrary = require('@prisma/client')
      hookPrisma(prismaClientLibrary);
      client = new prismaClientLibrary.PrismaClient();
    })

    beforeEach(() => {
      const handlerInputs = new HandlerInputsBuilder().build();
      TracerGlobals.setHandlerInputs(handlerInputs);

      SpansContainer.clearSpans();
    });

    afterAll(() => client && client.$disconnect());

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
  })
});
