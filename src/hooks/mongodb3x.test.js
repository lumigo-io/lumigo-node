import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import {
  getMockedMongoClientLibrary,
  promisifyMongoFunc,
  wrapMongoCollection,
} from '../../testUtils/mongo3xMocker';
import { MongoSpanBuilder } from '../../testUtils/mongoSpanBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { hookMongoDb } from './mongodb';

const DUMMY_URL = 'mongodb://localhost:27017/myproject';

describe('mongodb3x', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hookMongoDb -> simple flow', async () => {
    const mongoClientLibrary = getMockedMongoClientLibrary();

    hookMongoDb(mongoClientLibrary);
    const connection = await promisifyMongoFunc(mongoClientLibrary.MongoClient.connect)(
      DUMMY_URL,
      {}
    );
    const collection = connection.db().collection('documents');
    wrapMongoCollection(collection, 'insert');

    const docs = [{ a: 1 }, { a: 2 }, { a: 3 }];
    await promisifyMongoFunc(collection.insert)(docs);

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
    connection.close();
  });

  test('hookMongoDb -> error', async () => {
    const mongoClientLibrary = getMockedMongoClientLibrary();

    hookMongoDb(mongoClientLibrary);
    const connection = await promisifyMongoFunc(mongoClientLibrary.MongoClient.connect)(
      DUMMY_URL,
      {}
    );
    const collection = connection.db().collection('documents1');
    wrapMongoCollection(collection, 'insert', true);

    const docs = [{ a: 1 }, { a: 2 }, { a: 3 }];
    await promisifyMongoFunc(collection.insert)(docs);

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
    connection.close();
  });

  test('hookMongoDb -> instrument Failed', async () => {
    const mongoClientLibrary = getMockedMongoClientLibrary({ instrumentFailed: true });

    hookMongoDb(mongoClientLibrary);
    const connection = await promisifyMongoFunc(mongoClientLibrary.MongoClient.connect)(
      DUMMY_URL,
      {}
    );
    const collection = connection.db().collection('documents');
    wrapMongoCollection(collection, 'insert');

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([]);
    connection.close();
  });
});
