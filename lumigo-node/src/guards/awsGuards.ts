import { LambdaContext } from '../types/aws/awsEnvironment';

export function isAwsContext(awsContext: LambdaContext | any): awsContext is LambdaContext {
  const context = awsContext as LambdaContext;
  return (
    context.invokedFunctionArn !== undefined &&
    context.awsRequestId !== undefined &&
    context.callbackWaitsForEmptyEventLoop !== undefined &&
    context.functionName !== undefined &&
    context.getRemainingTimeInMillis !== undefined &&
    context.logGroupName !== undefined &&
    context.logStreamName !== undefined &&
    context.memoryLimitInMB !== undefined
  );
}
