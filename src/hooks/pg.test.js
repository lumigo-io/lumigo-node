import { createMockedClient, createMockedResponse } from '../../testUtils/pgMocker';
import { hookPg } from './pg';
import { SpansContainer, TracerGlobals } from '../globals';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';
import { SqlSpanBuilder } from '../../testUtils/sqlSpanBuilder';
import { payloadStringify } from '../utils/payloadStringify';
// import { safeExecute } from '../utils';

const DUMMY_PG_OPTIONS = {
  host: 'database-1.us-west-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgresUser',
  database: 'UsersDB',
};

const createHookedPgClient = (mockOptions = {}) => {
  const pgLib = createMockedClient(mockOptions);
  hookPg(pgLib);

  const { Client } = pgLib;
  const client = new Client(DUMMY_PG_OPTIONS);
  return client;
};

const createBaseBuilderFromSpan = (span) =>
  new SqlSpanBuilder().withId(span.id).withStarted(span.started).withEnded(span.ended);

const createExpectedResponse = () => {
  const response = createMockedResponse();
  return {
    rowCount: response.rowCount,
    rows: payloadStringify(response.rows),
  };
};

describe('pg', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hookPg -> query (text: string) => Promise -> success', async () => {
    const client = createHookedPgClient();

    await client.query('SELECT * from users');

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters(DUMMY_PG_OPTIONS)
        .withResponse(createExpectedResponse())
        .build(),
    ]);
  });

  test('hookPg -> query (text: string) => Promise -> error (with await-catch)', async () => {
    const error = new Error('RandomError');
    const client = createHookedPgClient({ error });
    let errorIsRaised = false;

    try {
      await client.query('SELECT * from users');
    } catch (e) {
      expect(e.name).toEqual('Error');
      expect(e.message).toEqual('RandomError');
      errorIsRaised = true;
    }

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters(DUMMY_PG_OPTIONS)
        .withError(payloadStringify(error))
        .build(),
    ]);
    expect(errorIsRaised).toBeTruthy();
  });

  test('hookPg -> query (text: string) => Promise -> error (with catch)', async () => {
    const error = new Error('RandomError');
    const client = createHookedPgClient({ error });
    let errorIsRaised = false;

    await client.query('SELECT * from users').catch((e) => {
      expect(e.name).toEqual('Error');
      expect(e.message).toEqual('RandomError');
      errorIsRaised = true;
    });

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters(DUMMY_PG_OPTIONS)
        .withError(payloadStringify(error))
        .build(),
    ]);
    expect(errorIsRaised).toBeTruthy();
  });

  test('hookPg -> query ({query: string, values: string[]}) => Promise -> success', async () => {
    const client = createHookedPgClient();

    await client.query({
      text: 'insert into "users" ("user_name") values ($1)',
      values: ['Value'],
    });

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('insert into "users" ("user_name") values ($1)')
        .withConnectionParameters(DUMMY_PG_OPTIONS)
        .withResponse(createExpectedResponse())
        .withValues(payloadStringify(['Value']))
        .build(),
    ]);
  });

  test('hookPg -> query (text: string, values: Array) => Promise -> success', async () => {
    const client = createHookedPgClient();

    await client.query('SELECT * from users', ['Value']);

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters(DUMMY_PG_OPTIONS)
        .withResponse(createExpectedResponse())
        .withValues(payloadStringify(['Value']))
        .build(),
    ]);
  });

  test('hookPg -> query (text: string, callback: Function) => void -> success', (done) => {
    const client = createHookedPgClient({
      activeQuery: {},
    });

    const testFunc = () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_PG_OPTIONS)
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    };

    client.query('SELECT * from users', testFunc);
  });

  test('hookPg no activeQuery but with activeQueue -> query (text: string, callback: Function) => void -> success', (done) => {
    const client = createHookedPgClient({
      queryQueue: [],
      activeQuery: undefined,
    });
    const testFunc = () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_PG_OPTIONS)
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    };

    client.query('SELECT * from users', testFunc);
  });

  test('hookPg -> query (text: string, callback: Function) => void -> error', (done) => {
    const error = new Error('RandomError');
    const client = createHookedPgClient({ error, activeQuery: {} });

    const testFunc = (err) => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_PG_OPTIONS)
          .withError(payloadStringify(error))
          .build(),
      ]);
      expect(err).toEqual(error);
      done();
    };

    client.query('SELECT * from users', testFunc);
  });

  test('hookPg -> query (text: string, values: Array, callback: Function) => void -> success', (done) => {
    const client = createHookedPgClient({
      activeQuery: {},
    });

    const testFunc = () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_PG_OPTIONS)
          .withResponse(createExpectedResponse())
          .withValues(payloadStringify(['Value']))
          .build(),
      ]);
      done();
    };

    client.query('SELECT * from users', ['Value'], testFunc);
  });
});
