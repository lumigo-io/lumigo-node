import {
  isAwsEnvironment,
  isLambdaWrapped,
  isSwitchedOff,
  safeExecute,
  setLambdaWrapped,
} from '../utils';
import { Http } from './http';
import { hookMongoDb } from './mongodb';
import { hookMssql } from './msSql';
import { hookMySql } from './mySql';
import { hookNeo4j } from './neo4j';
import { hookPg } from './pg';
import { hookPrisma } from './prisma';
import { hookRedis } from './redis';
import { FetchInstrumentation } from './fetch';

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
      safeExecute(hookPrisma)();
      safeExecute(FetchInstrumentation.startInstrumentation)();
    }
  }
};
