import httpHook from './http';
import { isSwitchedOff, isAwsEnvironment, isLambdaWrapped, setLambdaWrapped } from '../utils';
import { hookMongoDb } from './mongodb';
import { hookRedis } from './redis';
import { hookPg } from './pg';
import { hookMySql } from './mySql';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isLambdaWrapped()) {
      httpHook();
      hookMongoDb();
      hookRedis();
      hookPg();
      hookMySql();
      setLambdaWrapped();
    }
  }
};
