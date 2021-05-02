export interface AwsEnvironment {
  awsRegion: string;
  awsExecutionEnv: string;
  awsXAmznTraceId: string;
  awsLambdaTaskRoot: string;
  awsLambdaRuntimeDir: string;
  awsLambdaFunctionName: string;
  awsLambdaLogGroupName: string;
  awsLambdaLogStreamName: string;
  awsLambdaFunctionVersion: string;
  awsLambdaFunctionMemorySize: string;
}
