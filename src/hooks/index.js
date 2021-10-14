import { isSwitchedOff, isAwsEnvironment, isLambdaWrapped, setLambdaWrapped, safeExecute } from '../utils';
import { hookMongoDb } from './mongodb';
import { hookRedis } from './redis';
import { hookPg } from './pg';
import { hookMySql } from './mySql';
import { hookMssql } from './msSql';
import { hookNeo4j } from './neo4j';
import { Http } from './http';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isLambdaWrapped()) {
      safeExecute(Http.hookHttp)();
      safeExecute(hookMongoDb)();
      safeExecute(hookRedis)();
      safeExecute(hookPg)();
      safeExecute(hookMySql)();
      safeExecute(hookMssql)();
      safeExecute(hookNeo4j)();
      safeExecute(setLambdaWrapped)();
    }
  }
};
