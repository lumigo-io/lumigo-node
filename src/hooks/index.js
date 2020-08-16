import httpHook from './http';
import { isSwitchedOff, isAwsEnvironment, isLambdaWrapped, setLambdaWrapped } from '../utils';
import { hookMongoDb } from './mongodb';
import { hookRedis } from './redis';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isLambdaWrapped()) {
      httpHook();
      hookMongoDb();
      hookRedis();
      setLambdaWrapped();
    }
  }
};
