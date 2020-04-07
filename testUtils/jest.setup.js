import { HttpsRequestsForTesting, HttpsScenarioBuilder } from './httpsMocker';
import { createAwsEnvVars } from './awsTestUtils';
import { ConsoleWritesForTesting } from './consoleMocker';
import { SpansContainer, TracerGlobals } from '../src/globals';

jest.mock('../package.json');
jest.mock('https');
jest.mock('console');

const oldEnv = Object.assign({}, process.env);

/* eslint-disable */
jest.spyOn(global.console, 'log');
jest.spyOn(global.console, 'error');
jest.spyOn(global.console, 'warn');
jest.spyOn(global.console, 'info');
global.console.log.mockImplementation(() => {});
global.console.error.mockImplementation(() => {});
global.console.warn.mockImplementation(() => {});
global.console.info.mockImplementation(() => {});
/* eslint-enable */

beforeEach(() => {
  HttpsRequestsForTesting.clean();
  HttpsScenarioBuilder.clean();
  ConsoleWritesForTesting.clean();
  SpansContainer.clearSpans();
  TracerGlobals.clearHandlerInputs();
  TracerGlobals.clearTracerInputs();

  const awsEnv = createAwsEnvVars();
  process.env = { ...oldEnv, ...awsEnv };
});

afterEach(() => {
  process.env = { ...oldEnv };
});
