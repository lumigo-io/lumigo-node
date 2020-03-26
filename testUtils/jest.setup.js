import { cleanHttpMocker } from './httpsMocker';
import { createAwsEnvVars } from './awsTestUtils';

jest.mock('../package.json');
jest.mock('https');

const oldEnv = Object.assign({}, process.env);

beforeEach(() => {
  cleanHttpMocker();
  const awsEnv = createAwsEnvVars();
  process.env = { ...oldEnv, ...awsEnv };
});

afterEach(() => {
  process.env = { ...oldEnv };
});
