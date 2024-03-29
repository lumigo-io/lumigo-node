import { HttpSpanBuilder } from './httpSpanBuilder';

export class MongoSpanBuilder {
  constructor() {
    this._span = {
      account: HttpSpanBuilder.DEFAULT_ACCOUNT,
      ended: 1256,
      id: 'not-a-random-id',
      info: {
        logGroupName: `/aws/lambda/${HttpSpanBuilder.DEFAULT_FUNC_NAME}`,
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        traceId: HttpSpanBuilder.DEFAULT_TRACE_ID,
        tracer: HttpSpanBuilder.DEFAULT_TRACER,
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      parentId: HttpSpanBuilder.DEFAULT_PARENT_ID,
      reporterAwsRequestId: HttpSpanBuilder.DEFAULT_PARENT_ID,
      readiness: 'cold',
      region: HttpSpanBuilder.DEFAULT_REGION,
      invokedArn: HttpSpanBuilder.DEFAULT_ARN,
      invokedVersion: HttpSpanBuilder.DEFAULT_VERSION,
      runtime: 'AWS_Lambda_nodejs8.10',
      started: 1234,
      token: '',
      mongoConnectionId: 1,
      mongoOperationId: undefined,
      mongoRequestId: 13,
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'mongoDb',
      vendor: 'AWS',
      version: '$LATEST',
    };
  }

  withRequest = request => {
    this._span.request = request;
    return this;
  };
  withResponse = response => {
    this._span.response = response;
    return this;
  };
  withStarted = started => {
    this._span.started = started;
    return this;
  };
  withId = id => {
    this._span.id = id;
    return this;
  };
  withEnded = ended => {
    this._span.ended = ended;
    return this;
  };
  withDatabaseName = databaseName => {
    this._span.databaseName = databaseName;
    return this;
  };
  withCommandName = commandName => {
    this._span.commandName = commandName;
    return this;
  };
  withError = error => {
    this._span.error = error;
    return this;
  };

  onlyMetadata = () => {
    delete this._span?.request;
    delete this._span?.response;
    this._span['isMetadata'] = true;
    return this;
  }

  build = () => {
    return this._span;
  };
}
