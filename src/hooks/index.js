import { isSwitchedOff, isAwsEnvironment, isLambdaWrapped, setLambdaWrapped } from '../utils';
import { hookMongoDb } from './mongodb';
import { hookRedis } from './redis';
import { hookPg } from './pg';
import { hookMySql } from './mySql';
import { hookMssql } from './msSql';
import { hookMongoose } from './mongoose';
import { hookNeo4j } from './neo4j';
import { Http } from './http';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isLambdaWrapped()) {
      Http.hookHttp();
      hookMongoDb();
      hookMongoose();
      hookRedis();
      hookPg();
      hookMySql();
      hookMssql();
      hookNeo4j();
      setLambdaWrapped();
    }
  }
};
