import { hookHttp } from './http';
import { isSwitchedOff, isAwsEnvironment, isLambdaWrapped, setLambdaWrapped } from '../utils';
import { hookMongoDb } from './mongodb';
import { hookRedis } from './redis';
import { hookPg } from './pg';
import { hookMySql } from './mySql';
import { hookMssql } from './msSql';
import { hookNeo4j } from './neo4j';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    if (!isLambdaWrapped()) {
      hookHttp();
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
