import { hookMongoose } from './mongoose';
import { SpansContainer, TracerGlobals } from '../globals';
import { MongoSpanBuilder } from '../../testUtils/mongoSpanBuilder';
import { HandlerInputesBuilder } from '../../testUtils/handlerInputesBuilder';
import { sleep } from '../../testUtils/sleep';
const mockingoose = require('mockingoose');
const mongoose = require('mongoose');

const DUMMY_CONNECTION_STRING =
  'mongodb+srv://dbUser:lumigoFree@cluster0.obd2g.mongodb.net/myFirstDatabase?retryWrites=true&w=majority';

const { Schema } = mongoose;

const schema = Schema({
  name: String,
  email: String,
  created: { type: Date, default: Date.now },
});

const User = mongoose.model('User', schema);

describe('test mongoose User model', () => {
  beforeAll(() => {
    hookMongoose(mongoose);
  });
  beforeEach(() => {
    mockingoose.resetAll();
    const handlerInputs = new HandlerInputesBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });
  it('should return the doc with findById', async () => {
    await mongoose.connect(DUMMY_CONNECTION_STRING);
    const _doc = {
      _id: '507f191e810c19729de860ea',
      name: 'name',
      email: 'name@email.com',
    };

    mockingoose(User).toReturn(_doc, 'findById');
    const doc = await User.findById('507f191e810c19729de860ea');
    const spans = SpansContainer.getSpans();
    const expectedSpan = new MongoSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withRequest('{"_id":"507f191e810c19729de860ea"}')
      .withResponse(JSON.stringify(doc))
      .withDatabaseName('myFirstDatabase')
      .withCommandName('findOne')
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  it('should return the doc with create', async () => {
    await mongoose.connect(DUMMY_CONNECTION_STRING);
    const _doc = {
      _id: '507f191e810c19729de860ea',
      name: 'name',
      email: 'name@email.com',
    };

    mockingoose(User).toReturn(_doc, 'create');
    const doc = await User.create(_doc);
    const spans = SpansContainer.getSpans();
    const expectedSpan = new MongoSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withRequest('{"_id":"507f191e810c19729de860ea","name":"name","email":"name@email.com"}')
      .withResponse(JSON.stringify(doc))
      .withDatabaseName('myFirstDatabase')
      .withCommandName('create')
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  it('should throw an error and create error span', async () => {
    await mongoose.connect(DUMMY_CONNECTION_STRING);
    mockingoose(User).toReturn(new Error('My Error'), 'save');
    User.create({ name: 'name', email: 'name@email.com' }).catch(async (err) => {
      await sleep(1);
      const spans = SpansContainer.getSpans();
      expect(err.stack).toEqual(JSON.parse(JSON.parse(spans[0].error)).stack);
      expect(err.message).toEqual('My Error');
    });
  });
});
