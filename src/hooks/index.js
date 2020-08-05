import httpHook from './http';
import { isSwitchedOff, isAwsEnvironment, isHttpWrapped, setHttpWrapped } from '../utils';
import { hookMongoDb } from './mongodb';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isHttpWrapped()) {
      httpHook();
      setHttpWrapped();
    }
    hookMongoDb();
  }
};
