import { HttpsRequestsForTesting, HttpsScenarioBuilder } from './httpsMocker';
import { AxiosMocker } from './axiosMocker';
import { createAwsEnvVars } from './awsTestUtils';
import { LogStore } from '../src/logger';
import { ConsoleMocker, ConsoleWritesForTesting } from './consoleMocker';
import { HttpSpansAgent } from '../src/httpSpansAgent';
import * as globals from '../src/globals';
import axios from 'axios';
import { MongoMockerEventEmitter } from './mongoMocker';
import path from 'path';
import { TracerGlobals } from '../src/globals';

jest.mock('../package.json');
jest.mock('https');
AxiosMocker.createAxiosMocker(axios);

const oldEnv = Object.assign({}, process.env);
const originalConsole = global.console;

beforeEach(() => {
  AxiosMocker.clean();
  HttpsRequestsForTesting.clean();
  HttpsScenarioBuilder.clean();
  ConsoleWritesForTesting.clean();
  globals.clearGlobals();
  TracerGlobals.clearTracerInputs();
  LogStore.clean();
  HttpSpansAgent.cleanSessionInstance();
  MongoMockerEventEmitter.cleanEventEmitter();

  const awsEnv = createAwsEnvVars();
  process.env = { ...oldEnv, ...awsEnv };

  global.console = ConsoleMocker;
  process.env.NODE_PATH = path.resolve(__dirname, '../node_modules');
});

afterEach(() => {
  process.env = { ...oldEnv };
  global.console = originalConsole;
});
