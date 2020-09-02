import { createMockedClient, createMockedResponse } from '../../testUtils/mySqlMocker';
import { SpansContainer, TracerGlobals } from '../globals';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';
import { SqlSpanBuilder } from '../../testUtils/sqlSpanBuilder';
import { payloadStringify } from '../utils/payloadStringify';
import { MYSQL_SPAN } from '../spans/awsSpan';
import { hookMySql } from './mySql';

const DUMMY_OPTIONS = {
  host: 'database-1.us-west-1.rds.amazonaws.com',
  port: 5432,
  user: 'user',
  database: 'UsersDb',
};

const createHookedMySqlV2Client = (mockOptions = {}) => {
  const mySql = createMockedClient({
    mySqlVersion: '2',
    ...mockOptions,
  });
  hookMySql(mySql);

  const { Connection } = mySql;
  const client = new Connection(DUMMY_OPTIONS);
  return client;
};

const createHookedMySqlV1Client = (mockOptions = {}) => {
  const mySql = createMockedClient({
    mySqlVersion: '1',
    ...mockOptions,
  });
  hookMySql(mySql);

  return new mySql(DUMMY_OPTIONS);
};

const createBaseBuilderFromSpan = span =>
  new SqlSpanBuilder()
    .withId(span.id)
    .withType(MYSQL_SPAN)
    .withStarted(span.started)
    .withEnded(span.ended);

const createExpectedResponse = () => {
  return { rows: payloadStringify(createMockedResponse()) };
};

describe('mySql', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('v2 -> hook -> query (text: string, callback: Function) -> success', done => {
    const client = createHookedMySqlV2Client();

    client.query('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    });
  });

  test('v2 -> hook -> query (text: string, values: List, callback: Function) -> success', done => {
    const client = createHookedMySqlV2Client();

    client.query('SELECT * from users', ['123'], () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withValues(payloadStringify(['123']))
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    });
  });

  test('v2 -> hook -> query (text: string, callback: Function) -> fail', done => {
    const error = new Error('DuumyError');
    const client = createHookedMySqlV2Client({ error });

    client.query('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withError(payloadStringify(error))
          .build(),
      ]);
      done();
    });
  });

  test('v2 -> hook -> query (text: string, values: List, callback: Function) -> fail', done => {
    const error = new Error('DuumyError');
    const client = createHookedMySqlV2Client({ error });

    client.query('SELECT * from users', ['123'], () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withValues(payloadStringify(['123']))
          .withError(payloadStringify(error))
          .build(),
      ]);
      done();
    });
  });

  test('v2 -> hook -> execute(text: string, callback: Function) -> success', done => {
    const client = createHookedMySqlV2Client();

    client.execute('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    });
  });

  test('v2 -> hook -> execute (text: string, values: List, callback: Function) -> success', done => {
    const client = createHookedMySqlV2Client();

    client.execute('SELECT * from users', ['123'], () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withValues(payloadStringify(['123']))
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    });
  });

  test('v2 -> hook -> execute (text: string, callback: Function) -> fail', done => {
    const error = new Error('DuumyError');
    const client = createHookedMySqlV2Client({ error });

    client.execute('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withError(payloadStringify(error))
          .build(),
      ]);
      done();
    });
  });

  test('v2 -> hook -> execute (text: string, values: List, callback: Function) -> fail', done => {
    const error = new Error('DuumyError');
    const client = createHookedMySqlV2Client({ error });

    client.execute('SELECT * from users', ['123'], () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withValues(payloadStringify(['123']))
          .withError(payloadStringify(error))
          .build(),
      ]);
      done();
    });
  });

  test('v1 -> hook -> query (text: string, callback: Function) -> success', done => {
    const client = createHookedMySqlV1Client();

    client.query('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    });
  });

  test('v1 -> hook -> query (text: string, values: List, callback: Function) -> success', done => {
    const client = createHookedMySqlV1Client();

    client.query('SELECT * from users', ['123'], () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withValues(payloadStringify(['123']))
          .withResponse(createExpectedResponse())
          .build(),
      ]);
      done();
    });
  });

  test('v1 -> hook -> query (text: string, callback: Function) -> fail', done => {
    const error = new Error('DuumyError');
    const client = createHookedMySqlV1Client({ error });

    client.query('SELECT * from users', () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withError(payloadStringify(error))
          .build(),
      ]);
      done();
    });
  });

  test('v1 -> hook -> query (text: string, values: List, callback: Function) -> fail', done => {
    const error = new Error('DuumyError');
    const client = createHookedMySqlV1Client({ error });

    client.query('SELECT * from users', ['123'], () => {
      const spans = SpansContainer.getSpans();
      expect(spans).toEqual([
        createBaseBuilderFromSpan(spans[0])
          .withQuery('SELECT * from users')
          .withConnectionParameters(DUMMY_OPTIONS)
          .withValues(payloadStringify(['123']))
          .withError(payloadStringify(error))
          .build(),
      ]);
      done();
    });
  });
});
