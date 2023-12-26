import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { PrismaSpanBuilder } from '../../testUtils/prismaSpanBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { getRandomId } from '../utils';
import { hookPrisma } from './prisma';
import { PrismaClient } from '@prisma/client';

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
        .withQueryArgs("{}")
        .withResult(count.toString())
        .build();

      expect(spans[0]).toEqual(expectedSpan);
    });

    test('operation with arguments', async () => {
      const email = getRandomId()

      const user = await client.user.create({ data: { name: 'John Doe', email } });
      await client.user.findFirst({ where: { id: user.id } });

      const spans = SpansContainer.getSpans();
      expect(spans).toHaveLength(2);

      const [createUserSpan, findUserSpan] = spans;

      const expectedCreateSpan = new PrismaSpanBuilder()
        .withId(createUserSpan.id)
        .withStarted(createUserSpan.started)
        .withEnded(createUserSpan.ended)
        .withModelName('User')
        .withOperation('create')
        .withQueryArgs(`{\"data\":{\"name\":\"John Doe\",\"email\":\"${email}\"}}`)
        .withResult(`{\"id\":${user.id},\"email\":\"${email}\",\"name\":\"John Doe\"}`)
        .build();

      const expectedFindSpan = new PrismaSpanBuilder()
        .withId(findUserSpan.id)
        .withStarted(findUserSpan.started)
        .withEnded(findUserSpan.ended)
        .withModelName('User')
        .withOperation('findFirst')
        .withQueryArgs(`{\"where\":{\"id\":${user.id}}}`)
        .withResult(`{\"id\":${user.id},\"email\":\"${email}\",\"name\":\"John Doe\"}`)
        .warm()
        .build();

      expect(createUserSpan).toEqual(expectedCreateSpan);
      expect(findUserSpan).toEqual(expectedFindSpan);
    });

    test("operation with error", async () => {
      const email = getRandomId();

      const user = await client.user.create({ data: { name: 'John Doe', email } });
      await expect(client.user.create({ data: { name: 'John Doe', email } })).rejects.toThrowError("Unique constraint failed on the fields");

      const spans = SpansContainer.getSpans();
      expect(spans).toHaveLength(2);

      const [successSpan, errorSpan] = spans;

      const expectedSuccessSpan = new PrismaSpanBuilder()
        .withId(successSpan.id)
        .withStarted(successSpan.started)
        .withEnded(successSpan.ended)
        .withModelName('User')
        .withOperation('create')
        .withQueryArgs(`{\"data\":{\"name\":\"John Doe\",\"email\":\"${email}\"}}`)
        .withResult(`{\"id\":${user.id},\"email\":\"${email}\",\"name\":\"John Doe\"}`)
        .build();

      const expectedErrorSpan = new PrismaSpanBuilder()
        .withId(errorSpan.id)
        .withStarted(errorSpan.started)
        .withEnded(errorSpan.ended)
        .withModelName('User')
        .withOperation('create')
        .withQueryArgs(`{\"data\":{\"name\":\"John Doe\",\"email\":\"${email}\"}}`)
        .withError(expect.stringContaining("Unique constraint failed on the fields"))
        .warm()
        .build();

      expect(successSpan).toEqual(expectedSuccessSpan);
      expect(errorSpan).toEqual(expectedErrorSpan);
    })
  })
})
