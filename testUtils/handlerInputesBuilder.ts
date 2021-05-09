import { HttpSpanBuilder } from './httpSpanBuilder';
import { Context } from 'aws-lambda';

export class HandlerInputesBuilder {
  _event: any
  _context: Context

  static DEFAULT_AWS_REQUEST_ID = HttpSpanBuilder.DEFAULT_PARENT_ID;
  static DEFAULT_INVOKED_FUNCTION_ARN = HttpSpanBuilder.DEFAULT_ARN;
  static DEFAULT_FUNCTION_VERSION = HttpSpanBuilder.DEFAULT_VERSION;
  static DEFAULT_TIMEOUT = 10 * 1000;

  constructor() {
    this._event = {};
    this._context = {
      done(): void {},
      fail(): void {},
      succeed(): void {},
      awsRequestId: HandlerInputesBuilder.DEFAULT_AWS_REQUEST_ID,
      invokedFunctionArn: HandlerInputesBuilder.DEFAULT_INVOKED_FUNCTION_ARN,
      functionVersion: HandlerInputesBuilder.DEFAULT_FUNCTION_VERSION,
      getRemainingTimeInMillis: () => HandlerInputesBuilder.DEFAULT_TIMEOUT,
      memoryLimitInMB: "256",
      logStreamName: "2021/05/09/[$LATEST]e28afd9b76e94a24b0ec26460ad50203",
      logGroupName: `/aws/lambda/${HttpSpanBuilder.DEFAULT_FUNC_NAME}`,
      identity: undefined,
      functionName: HttpSpanBuilder.DEFAULT_FUNC_NAME,
      callbackWaitsForEmptyEventLoop: false,
      clientContext: undefined
    };
  }

  withAwsRequestId = awsRequestId => {
    this._context.awsRequestId = awsRequestId;
    return this;
  };

  withInvokedFunctionArn = invokedFunctionArn => {
    this._context.invokedFunctionArn = invokedFunctionArn;
    return this;
  };

  withTimeout = timeout => {
    this._context.getRemainingTimeInMillis = () => timeout;
    return this;
  };

  build = () => ({
    event: this._event,
    context: this._context,
  });
}
