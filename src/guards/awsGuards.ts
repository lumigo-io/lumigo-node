import { Context } from 'aws-lambda/handler';

export function isAwsContext(awsContext: Context | any): awsContext is Context {
  const context = awsContext as Context;
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
