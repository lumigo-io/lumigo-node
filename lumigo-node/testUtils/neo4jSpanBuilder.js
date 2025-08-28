import { HttpSpanBuilder } from './httpSpanBuilder';

export class Neo4jSpanBuilder {
  constructor() {
    const baseSpan = {
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
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'neo4j',
      vendor: 'AWS',
      version: '$LATEST',
    };
    this._span = {
      ...baseSpan,
      connectionParameters: null,
      query: null,
      params: '{}',
    };
  }

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
  withConnectionParameters = connectionParameters => {
    this._span.connectionParameters = connectionParameters;
    return this;
  };
  withQuery = query => {
    this._span.query = query;
    return this;
  };
  withResponse = response => {
    this._span.response = response;
    return this;
  };
  withSummary = summary => {
    this._span.summary = summary;
    return this;
  };
  withError = error => {
    this._span.error = error;
    return this;
  };
  withParams = params => {
    this._span.params = params;
    return this;
  };
  withType = type => {
    this._span.type = type;
    return this;
  };
  build = () => {
    return this._span;
  };
}
