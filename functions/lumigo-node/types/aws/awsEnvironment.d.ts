import { Context } from 'aws-lambda';
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
export interface ContextInfo {
    functionName: string;
    awsRequestId: string;
    awsAccountId: string;
    remainingTimeInMillis: number;
    callbackWaitsForEmptyEventLoop: boolean;
}
export interface LambdaContext extends Context {
    __wrappedByLumigo?: boolean | undefined;
}
