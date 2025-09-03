import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { TracerGlobals } from '../globals';
import { hookMongoDb } from './mongodb';

const DUMMY_URL = 'mongodb://localhost:27017/myproject';

describe('mongodb', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hookMongoDb -> mongodb client not installed', async () => {
    hookMongoDb();
  });

  test('hookMongoDb -> unexpected mongodb client library', async () => {
    hookMongoDb({});
  });
});
