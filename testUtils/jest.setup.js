import { HttpsRequestsForTesting, HttpsScenarioBuilder } from './httpsMocker';
import { createAwsEnvVars } from './awsTestUtils';
import { LogStore } from '../src/logger';
import { ConsoleMocker, ConsoleWritesForTesting } from './consoleMocker';
import { SpansContainer, TracerGlobals } from '../src/globals';

jest.mock('../package.json');
jest.mock('https');

const oldEnv = Object.assign({}, process.env);
const originalConsole = global.console;

beforeEach(() => {
  HttpsRequestsForTesting.clean();
  HttpsScenarioBuilder.clean();
  ConsoleWritesForTesting.clean();
  SpansContainer.clearSpans();
  TracerGlobals.clearHandlerInputs();
  TracerGlobals.clearTracerInputs();
  LogStore.clean();

  const awsEnv = createAwsEnvVars();
  process.env = { ...oldEnv, ...awsEnv };

  global.console = ConsoleMocker;
});

afterEach(() => {
  process.env = { ...oldEnv };
  global.console = originalConsole;
});
