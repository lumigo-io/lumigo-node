import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { createMockedClient, createMockedResponse } from '../../testUtils/msSqlMocker';
import { SqlSpanBuilder } from '../../testUtils/sqlSpanBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { MSSQL_SPAN } from '../spans/awsSpan';
import { payloadStringify } from '../utils/payloadStringify';
import { hookMssql } from './msSql';

const DUMMY_CONNECTION_STRING =
  'mssql://testUser:testUser1@mssql-16055-0.cloudclusters.net:16055/TestDB?encrypt=true';
const EXPECTED_OPTIONS = {
  database: 'TestDB',
  host: 'mssql-16055-0.cloudclusters.net',
  port: '16055',
  user: 'testUser',
};

const createHookedClient = (mockOptions = {}) => {
  const msSql = createMockedClient(mockOptions);
  hookMssql(msSql);
  return msSql;
};

const createBaseBuilderFromSpan = (span) =>
  new SqlSpanBuilder()
    .withId(span.id)
    .withType(MSSQL_SPAN)
    .withValues('')
    .withStarted(span.started)
    .withEnded(span.ended);

const createExpectedResponse = () => {
  const response = createMockedResponse();
  return { rows: payloadStringify(response.recordset), rowCount: response.rowsAffected };
};

describe('msSql', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hook -> query (text: string, callback: Function) -> success', (done) => {
    const client = createHookedClient();

    client.connect(DUMMY_CONNECTION_STRING);

    client.query('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(EXPECTED_OPTIONS)
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    });
  });

  /**
   * @group unhandled-rejection-expected
   */
  test('hook -> query (text: string, callback: Function) -> failed', (done) => {
    const client = createHookedClient({
      error: {
        errorMessage: 'BAD_ERROR',
      },
    });

    client.connect(DUMMY_CONNECTION_STRING);

    client.query('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(EXPECTED_OPTIONS)
          .withError(payloadStringify({ errorMessage: 'BAD_ERROR' }))
          .build(),
      ]);
      done();
    });
  });

  test('hook -> query (text: string): Promise -> success', async () => {
    const client = createHookedClient();

    await client.connect(DUMMY_CONNECTION_STRING);

    await client.query('SELECT * from users').then(() => {});
    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters(EXPECTED_OPTIONS)
        .withResponse(createExpectedResponse())
        .build(),
    ]);
  });

  test('hook -> ConnectionPool -> query (text: string): Promise -> success', async () => {
    const connectionConfig = {
      user: 'testUser',
      password: 'passwordPassword',
      host: 'TestDB.mssql-16055-0.cloudclusters.net',
      server: 'TestDB.mssql-16055-0.cloudclusters.net',
      port: '16055',
    };
    const msClient = createHookedClient();

    const client = await new msClient.ConnectionPool(connectionConfig).connect();

    await client.query('SELECT * from users').then(() => {});
    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters({
          ...EXPECTED_OPTIONS,
          host: 'TestDB.mssql-16055-0.cloudclusters.net',
        })
        .withResponse(createExpectedResponse())
        .build(),
    ]);
  });

  test('hook -> query (text: string[]): Promise -> success', async () => {
    const client = createHookedClient();

    await client.connect(DUMMY_CONNECTION_STRING);

    await client.query(['SELECT * from users']).then(() => {});
    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters(EXPECTED_OPTIONS)
        .withResponse(createExpectedResponse())
        .build(),
    ]);
  });

  test('hook -> query (text: string): Promise -> Failed', async () => {
    let foundError = false;
    const client = createHookedClient({
      error: {
        errorMessage: 'BAD_ERROR',
      },
    });

    await client.connect(DUMMY_CONNECTION_STRING);

    await client.query('SELECT * from users').catch(() => {
      foundError = true;
    });
    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withQuery('SELECT * from users')
        .withConnectionParameters(EXPECTED_OPTIONS)
        .withError(payloadStringify({ errorMessage: 'BAD_ERROR' }))
        .build(),
    ]);
    expect(foundError).toBeTruthy();
  });
});
