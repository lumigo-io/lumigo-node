import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { createMockedClient, createMockedResponse } from '../../testUtils/mySqlMocker';
import { SqlSpanBuilder } from '../../testUtils/sqlSpanBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { MYSQL_SPAN } from '../spans/awsSpan';
import { payloadStringify } from '../utils/payloadStringify';
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

const createBaseBuilderFromSpan = (span) =>
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
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  describe('v1 -> ', () => {
    test('hook -> query (text: string, callback: Function) -> success', (done) => {
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

    test('hook -> query (text: string, values: List, callback: Function) -> success', (done) => {
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

    test('hook -> query (text: string, callback: Function) -> fail', (done) => {
      const error = new Error('DummyError');
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

    test('hook -> query (text: string, values: List, callback: Function) -> fail', (done) => {
      const error = new Error('DummyError');
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

  describe('v2 -> ', () => {
    test('hook -> query (text: string, callback: Function) -> success', (done) => {
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

    test('hook -> query (options: object, callback: Function) -> sqlObject', (done) => {
      const client = createHookedMySqlV2Client();

      const sql = {
        _events: {},
        _eventsCount: 1,
        _callSite: {},
        _ended: false,
        _timer: {
          _timeout: null,
        },
        sql: 'CALL usp_get_pending_requests(?,?,?)',
        values: ['6784283985', '0', ''],
        typeCast: true,
        nestTables: false,
        _resultSet: null,
        _results: [],
        _fields: [],
        _index: 0,
        _loadError: null,
      };

      const sqlObject = { sql };

      const expectedQuery =
        '{"sql":"CALL usp_get_pending_requests(?,?,?)","values":["6784283985","0",""],"typeCast":true,"nestTables":false}';

      client.query(sqlObject, () => {
        const spans = SpansContainer.getSpans();
        expect(spans).toEqual([
          createBaseBuilderFromSpan(spans[0])
            .withQuery(expectedQuery)
            .withConnectionParameters(DUMMY_OPTIONS)
            .withResponse(createExpectedResponse())
            .build(),
        ]);
        done();
      });
    });

    test('hook -> query (options: Object, callback: Function) -> success', (done) => {
      const client = createHookedMySqlV2Client();

      client.query({ sql: 'SELECT * from users', values: ['123'] }, () => {
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

    test('hook -> query (text: string, callback: Function) -> Unknown query', (done) => {
      const client = createHookedMySqlV2Client();

      client.query(1, () => {
        const spans = SpansContainer.getSpans();
        expect(spans).toEqual([
          createBaseBuilderFromSpan(spans[0])
            .withQuery('Unknown')
            .withConnectionParameters(DUMMY_OPTIONS)
            .withResponse(createExpectedResponse())
            .build(),
        ]);
        done();
      });
    });

    test('hook -> query (text: string, values: List, callback: Function) -> success', (done) => {
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

    test('hook -> object query (text: string, callback: Function) -> success', (done) => {
      const client = createHookedMySqlV2Client();

      client.query({ sql: 'SELECT * from users' }, () => {
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

    test('hook -> query (text: string, callback: Function) -> fail', (done) => {
      const error = new Error('DummyError');
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

    test('hook -> query (text: string, values: List, callback: Function) -> fail', (done) => {
      const error = new Error('DummyError');
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

    test('hook -> execute(text: string, callback: Function) -> success', (done) => {
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

    test('hook -> execute(text: string, arg: string, callback: Function) -> success', (done) => {
      const client = createHookedMySqlV2Client();

      client.execute('SELECT * FROM data WHERE name = ?', 'Jeff', () => {
        const spans = SpansContainer.getSpans();
        expect(spans).toEqual([
          createBaseBuilderFromSpan(spans[0])
            .withQuery('SELECT * FROM data WHERE name = ?')
            .withValues('"Jeff"')
            .withConnectionParameters(DUMMY_OPTIONS)
            .withResponse(createExpectedResponse())
            .build(),
        ]);
        done();
      });
    });

    test('hook -> execute(text: string, args: Object, callback: Function) -> success', (done) => {
      const client = createHookedMySqlV2Client();

      client.execute(
        'SELECT * FROM data WHERE name = ? AND surname = ?',
        { name: 'Jeff', surname: 'Jeffity' },
        () => {
          const spans = SpansContainer.getSpans();
          expect(spans).toEqual([
            createBaseBuilderFromSpan(spans[0])
              .withQuery('SELECT * FROM data WHERE name = ? AND surname = ?')
              .withValues('{"name":"Jeff","surname":"Jeffity"}')
              .withConnectionParameters(DUMMY_OPTIONS)
              .withResponse(createExpectedResponse())
              .build(),
          ]);
          done();
        }
      );
    });

    test('hook -> execute (text: string, values: List, callback: Function) -> success', (done) => {
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

    test('hook -> execute (text: string, callback: Function) -> fail', (done) => {
      const error = new Error('DummyError');
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

    test('hook -> execute (text: string, values: List, callback: Function) -> fail', (done) => {
      const error = new Error('DummyError');
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
  });
});
