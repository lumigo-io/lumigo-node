import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { getMockedMongoClient, wrapMongoCollection } from '../../testUtils/mongo4xMocker';
import { MongoSpanBuilder } from '../../testUtils/mongoSpanBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { hookMongoDb } from './mongodb';

const DUMMY_URL = 'mongodb://localhost:27017/myproject';

const validSimpleFlowArguments = [
  [[DUMMY_URL]],
  [[DUMMY_URL, {}]],
  [[DUMMY_URL, { url: DUMMY_URL }]],
  [[DUMMY_URL, undefined]],
];

const invalidSimpleFlowArguments = [[[0, 1]], [[0, 'abc']], [[0, () => {}]]];

describe('mongodb', () => {
  let connection;

  beforeEach(() => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  afterEach(() => {
    connection && connection.close();
  });

  test.each(validSimpleFlowArguments)('hookMongoDb -> simple flow', async (args) => {
    const { mongoClientLibrary } = getMockedMongoClient();

    hookMongoDb(mongoClientLibrary);
    const client = new mongoClientLibrary.MongoClient(...args);
    connection = await client.connect();
    const collection = connection.db().collection('documents');
    wrapMongoCollection(collection, 'insert');

    const docs = [{ a: 1 }, { a: 2 }, { a: 3 }];
    await collection.insert(docs);

    const spans = SpansContainer.getSpans();
    const expectedSpan = new MongoSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withRequest(
        '{"insert":"documents","documents":[{"a":1},{"a":2},{"a":3}],"ordered":true,"lsid":{"id":"2"},"txnNumber":1,"$clusterTime":{"clusterTime":123,"signature":"****"},"$db":"TracerDB"}'
      )
      .withResponse(
        '{"n":1,"opTime":{"ts":123456,"t":3},"electionId":7,"ok":1,"$clusterTime":{"clusterTime":123456,"signature":"****"},"operationTime":12345}'
      )
      .withDatabaseName('TracerDB')
      .withCommandName('insert')
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hookMongoDb -> error', async () => {
    const { mongoClientLibrary } = getMockedMongoClient();

    hookMongoDb(mongoClientLibrary);
    const client = new mongoClientLibrary.MongoClient(DUMMY_URL);
    connection = await client.connect();
    const collection = connection.db().collection('documents1');
    wrapMongoCollection(collection, 'insert', true);

    const docs = [{ a: 1 }, { a: 2 }, { a: 3 }];
    await collection.insert(docs);

    const spans = SpansContainer.getSpans();
    const expectedSpan = new MongoSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withRequest(
        '{"insert":"documents","documents":[{"a":1},{"a":2},{"a":3}],"ordered":true,"lsid":{"id":"2"},"txnNumber":1,"$clusterTime":{"clusterTime":123,"signature":"****"},"$db":"TracerDB"}'
      )
      .withDatabaseName('TracerDB')
      .withCommandName('insert')
      .withError('"Wow, what an error!"')
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hookMongoDb -> no args no hook', async () => {
    const { mongoClientLibrary } = getMockedMongoClient();

    hookMongoDb(mongoClientLibrary);
    const client = new mongoClientLibrary.MongoClient();
    const connect = async () => await client.connect();
    expect(connect()).rejects.toThrowError(
      'The "url" argument must be of type string. Received undefined'
    );
    expect(SpansContainer.getSpans().length).toEqual(0);
  });
});

test.each(invalidSimpleFlowArguments)('hookMongoDb -> invalid arguments', async (args) => {
  const { mongoClientLibrary } = getMockedMongoClient();

  hookMongoDb(mongoClientLibrary);
  const client = new mongoClientLibrary.MongoClient(...args);
  const connect = async () => await client.connect();
  expect(connect()).rejects.toThrowError(
    'The "url" argument must be of type string. Received type number (0)'
  );
  expect(SpansContainer.getSpans().length).toEqual(0);
});
