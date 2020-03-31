import { HttpSpanBuilder } from './httpSpanBuilder';

export class HandlerInputesBuilder {
  static DEFAULT_AWS_REQUEST_ID = HttpSpanBuilder.DEFAULT_PARENT_ID;
  static DEFAULT_INVOKED_FUNCTION_ARN = HttpSpanBuilder.DEFAULT_ARN;
  static DEFAULT_FUNCTION_VERSION = HttpSpanBuilder.DEFAULT_VERSION;

  constructor() {
    this._event = {};
    this._context = {
      awsRequestId: HandlerInputesBuilder.DEFAULT_AWS_REQUEST_ID,
      invokedFunctionArn: HandlerInputesBuilder.DEFAULT_INVOKED_FUNCTION_ARN,
      functionVersion: HandlerInputesBuilder.DEFAULT_FUNCTION_VERSION,
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

  build = () => ({
    event: this._event,
    context: this._context,
  });
}
