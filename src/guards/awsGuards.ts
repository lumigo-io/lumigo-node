import { LambdaContext } from '../types/aws/awsEnvironment';
import { supportsCallbackHandlers } from '../utils';

export function isAwsContext(awsContext: LambdaContext | any): awsContext is LambdaContext {
  const context = awsContext as LambdaContext;

  const baseChecks =
    context.invokedFunctionArn !== undefined &&
    context.awsRequestId !== undefined &&
    context.functionName !== undefined &&
    context.getRemainingTimeInMillis !== undefined &&
    context.logGroupName !== undefined &&
    context.logStreamName !== undefined &&
    context.memoryLimitInMB !== undefined;

  // Node.js 24+ doesn't have callbackWaitsForEmptyEventLoop since callbacks are deprecated
  return supportsCallbackHandlers()
    ? baseChecks && context.callbackWaitsForEmptyEventLoop !== undefined
    : baseChecks;
}
