import {
  getMockedMongoClient,
  promisifyMongoFunc,
  wrapMongoCollection,
} from '../../testUtils/mongoMocker';
import { SpansContainer, TracerGlobals } from '../globals';
import { hookMongoDb } from './mongodb';
import { MongoSpanBuilder } from '../../testUtils/mongoSpanBuilder';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';

const DUMMY_URL = 'mongodb://localhost:27017/myproject';

describe('mongodb', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hookMongoDb -> simple flow', async () => {
    const { mongoLib, mongoClient } = getMockedMongoClient();

    hookMongoDb(mongoLib);
    const connection = await promisifyMongoFunc(mongoClient.connect)(DUMMY_URL, {});
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
  });

  test('hookMongoDb -> error', async () => {
    const { mongoLib, mongoClient } = getMockedMongoClient();

    hookMongoDb(mongoLib);
    const connection = await promisifyMongoFunc(mongoClient.connect)(DUMMY_URL, {});
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
      .withError('"Wow What a error"')
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hookMongoDb -> instrument Failed', async () => {
    const { mongoLib, mongoClient } = getMockedMongoClient({ instrumentFailed: true });

    hookMongoDb(mongoLib);
    const connection = await promisifyMongoFunc(mongoClient.connect)(DUMMY_URL, {});
    const collection = connection.db().collection('documents');
    wrapMongoCollection(collection, 'insert');

    const spans = SpansContainer.getSpans();
    expect(spans).toEqual([]);
  });
});
