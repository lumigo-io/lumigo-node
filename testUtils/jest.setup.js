import { HttpsRequestsForTesting, HttpsScenarioBuilder } from './httpsMocker';
import { AxiosMocker } from './axiosMocker';
import { createAwsEnvVars } from './awsTestUtils';
import { LogStore } from '../src/logger';
import { ConsoleMocker, ConsoleWritesForTesting } from './consoleMocker';
import * as globals from '../src/globals';
import axios from 'axios';

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
  LogStore.clean();

  const awsEnv = createAwsEnvVars();
  process.env = { ...oldEnv, ...awsEnv };

  global.console = ConsoleMocker;
});

afterEach(() => {
  process.env = { ...oldEnv };
  global.console = originalConsole;
});
