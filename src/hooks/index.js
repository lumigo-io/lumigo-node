import { isSwitchedOff, isAwsEnvironment, isLambdaWrapped, setLambdaWrapped } from '../utils';
import { hookMongoDb } from './mongodb';
import { hookRedis } from './redis';
import { hookPg } from './pg';
import { hookMySql } from './mySql';
import { hookMssql } from './msSql';
import { hookNeo4j } from './neo4j';
import { Http } from './Http';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isLambdaWrapped()) {
      Http.hookHttp();
      hookMongoDb();
      hookRedis();
      hookPg();
      hookMySql();
      hookMssql();
      hookNeo4j();
      setLambdaWrapped();
    }
  }
};
