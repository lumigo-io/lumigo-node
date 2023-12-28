import axios from 'axios';
import path from 'path';
import * as globals from '../src/globals';
import { TracerGlobals } from '../src/globals';
import { HttpSpansAgent } from '../src/httpSpansAgent';
import { LogStore } from '../src/logger';
import { createAwsEnvVars } from './awsTestUtils';
import { AxiosMocker } from './axiosMocker';
import { ConsoleMocker, ConsoleWritesForTesting } from './consoleMocker';
import { HttpsRequestsForTesting, HttpsScenarioBuilder } from './httpsMocker';
import { MongoMockerEventEmitter } from './mongodbEventEmitterMocker';
import { unsetDebug } from "../src/utils";

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
  unsetDebug();

  global.console = ConsoleMocker;
  process.env.NODE_PATH = path.resolve(__dirname, '../node_modules');
});

afterEach(() => {
  process.env = { ...oldEnv };
  global.console = originalConsole;
});
