import { createMockedClient, createMockedResponse } from '../../testUtils/neo4jMocker';
import { SpansContainer, TracerGlobals } from '../globals';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';
import { Neo4jSpanBuilder } from '../../testUtils/neo4jSpanBuilder';
import { payloadStringify } from '../utils/payloadStringify';
import { NEO4J_SPAN } from '../spans/awsSpan';
import { hookNeo4j } from './neo4j';
import * as neo4jSpan from '../../src/spans/neo4jSpan';

const DUMMY_OPTIONS = {
  mode: 'READ',
  host: 'localhost',
  port: 7687,
  user: 'neo4j',
  database: 'neo4j',
};

const createHookedNeo4jSession = (mockOptions = {}) => {
  const Session = createMockedClient(mockOptions);
  hookNeo4j({ default: Session });

  const mode = DUMMY_OPTIONS.mode;
  const database = DUMMY_OPTIONS.database;
  const connectionProvider = {
    _authToken: {
      principal: DUMMY_OPTIONS.user,
    },
    _seedRouter: {
      _host: DUMMY_OPTIONS.host,
      _port: DUMMY_OPTIONS.port,
    },
  };

  const session = new Session(mode, connectionProvider, {}, database);
  return session;
};

const createBaseBuilderFromSpan = (span) =>
  new Neo4jSpanBuilder()
    .withId(span.id)
    .withType(NEO4J_SPAN)
    .withStarted(span.started)
    .withEnded(span.ended);

describe('neo4j', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hook -> run (text: string, params: object) -> success', async () => {
    const query = 'MATCH (u:User {id: $id}) RETURN u';
    const params = { id: '2fce6d1c-b060-4e3c-860a-9d6b3f01504f' };
    const response = createMockedResponse(query, params);
    const client = createHookedNeo4jSession({ response });

    await client.run(query, params);
    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withConnectionParameters(DUMMY_OPTIONS)
        .withQuery(query)
        .withParams(payloadStringify(params))
        .withResponse(payloadStringify(response.records, undefined, [[], 'keys']))
        .withSummary(payloadStringify(response.summary))
        .build(),
    ]);
  });

  test('hook -> run (text: string, params: object) -> error', async () => {
    const query = 'not-a-neo4j-query';
    const params = {};

    const error = new Error('Invalid Query');
    const client = createHookedNeo4jSession({ error });
    let foundError = false;

    await client.run(query, params).catch(() => {
      foundError = true;
    });
    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withConnectionParameters(DUMMY_OPTIONS)
        .withQuery(query)
        .withParams(payloadStringify(params))
        .withError(payloadStringify(error))
        .build(),
    ]);
    expect(foundError).toBeTruthy();
  });

  test('hook -> run (text: string, params: object) -> unstructured error', async () => {
    const query = 'MATCH (u:User {id: $id}) RETURN u';
    const params = { id: '2fce6d1c-b060-4e3c-860a-9d6b3f01504f' };
    const response = createMockedResponse(query, params);
    const client = createHookedNeo4jSession({ response });
    const createNeo4jSpanMock = jest.spyOn(neo4jSpan, 'extendNeo4jSpan').mockImplementation(() => {
      throw new Error("Cannot set property 'error' of undefined");
    });

    await client.run(query, params);
    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([
      createBaseBuilderFromSpan(spans[0])
        .withConnectionParameters(DUMMY_OPTIONS)
        .withQuery(query)
        .withParams(payloadStringify(params))
        .build(),
    ]);
    createNeo4jSpanMock.mockReset();
  });
});
