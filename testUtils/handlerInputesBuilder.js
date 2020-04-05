import { HttpSpanBuilder } from './httpSpanBuilder';

export class HandlerInputesBuilder {
  static DEFAULT_AWS_REQUEST_ID = HttpSpanBuilder.DEFAULT_PARENT_ID;
  static DEFAULT_INVOKED_FUNCTION_ARN = HttpSpanBuilder.DEFAULT_ARN;
  static DEFAULT_FUNCTION_VERSION = HttpSpanBuilder.DEFAULT_VERSION;
  static DEFAULT_TIMEOUT = 10 * 1000;

  constructor() {
    this._event = {};
    this._context = {
      awsRequestId: HandlerInputesBuilder.DEFAULT_AWS_REQUEST_ID,
      invokedFunctionArn: HandlerInputesBuilder.DEFAULT_INVOKED_FUNCTION_ARN,
      functionVersion: HandlerInputesBuilder.DEFAULT_FUNCTION_VERSION,
      getRemainingTimeInMillis: () => HandlerInputesBuilder.DEFAULT_TIMEOUT,
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
