import { isAwsContext } from './awsGuards';

describe('awsGuards', () => {
  test('isAwsContext => simple flow', () => {
    expect(
      isAwsContext({
        invokedFunctionArn: '',
        awsRequestId: '',
        callbackWaitsForEmptyEventLoop: '',
        clientContext: '',
        functionName: '',
        getRemainingTimeInMillis: '',
        logGroupName: '',
        logStreamName: '',
        memoryLimitInMB: '',
      })
    ).toBeTruthy();
  });

  test('isAwsContext => object is not context', () => {
    expect(
      isAwsContext({
        notContext: '',
      })
    ).toBeFalsy();
  });
});
