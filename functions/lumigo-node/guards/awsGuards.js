export function isAwsContext(awsContext) {
    const context = awsContext;
    return (context.invokedFunctionArn !== undefined &&
        context.awsRequestId !== undefined &&
        context.callbackWaitsForEmptyEventLoop !== undefined &&
        context.functionName !== undefined &&
        context.getRemainingTimeInMillis !== undefined &&
        context.logGroupName !== undefined &&
        context.logStreamName !== undefined &&
        context.memoryLimitInMB !== undefined);
}
