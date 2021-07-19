import httpHook from './http';
import { isSwitchedOff, isAwsEnvironment, isLambdaWrapped, setLambdaWrapped } from '../utils';
import { hookMongoDb } from './mongodb';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isLambdaWrapped()) {
      httpHook();
      hookMongoDb();
      setLambdaWrapped();
    }
  }
};
