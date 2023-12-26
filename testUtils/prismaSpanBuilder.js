import { PRISMA_SPAN } from '../src/spans/awsSpan';
import { HttpSpanBuilder } from './httpSpanBuilder';
import { payloadStringify } from '@lumigo/node-core/lib/common';

export class PrismaSpanBuilder {
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
      transactionId: '64a1b06067c2100c52e51ef4',
      type: PRISMA_SPAN,
      vendor: 'AWS',
      version: '$LATEST',
    };
  }

  build = () => {
    return this._span;
  };

  withId = (id) => {
    this._span.id = id;
    return this;
  }

  withModelName = (modelName) => {
    this._span.modelName = modelName;
    return this;
  }

  withOperation = (operation) => {
    this._span.operation = operation;
    return this;
  }

  withQueryArgs = (queryArgs) => {
    this._span.queryArgs = queryArgs;
    return this;
  }

  withValues = (values) => {
    this._span.values = values;
    return this;
  }

  withError = (error) => {
    this._span.error = error;
    return this;
  }

  withResult = (result) => {
    this._span.result = result;
    return this;
  }

  withStarted = (started) => {
    this._span.started = started;
    return this;
  }

  warm = () => {
    this._span.readiness = 'warm';
    return this;
  }

  withEnded = (ended) => {
    this._span.ended = ended;
    return this;
  }
}
