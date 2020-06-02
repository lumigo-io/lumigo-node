export class EnvironmentBuilder {
  constructor() {
    this._envs = {};
    this._envToDelete = [];
  }

  awsEnvironment = () => {
    this._envs['LAMBDA_RUNTIME_DIR'] = 'LAMBDA_RUNTIME_DIR';
    return this;
  };

  notAwsEnvironment = () => {
    this._envToDelete.push('LAMBDA_RUNTIME_DIR');
    return this;
  };

  applyEnv = () => {
    process.env = { ...process.env, ...this._envs };
    this._envToDelete.forEach(env => delete process.env[env]);
  };
}
