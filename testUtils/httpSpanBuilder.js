import { lowerCaseObjectKeys, stringifyAndPrune } from '../src/utils';

export class HttpSpanBuilder {
  constructor() {
    this._span = {
      account: '985323015126',
      ended: 1256,
      id: 'not-a-random-id',
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            body: '"the first rule of fight club"',
            headers: '{"Tyler":"Durden"}',
            host: 'your.mind.com',
            sendTime: 1234,
          },
          response: {},
        },
        logGroupName: '/aws/lambda/aws-nodejs-dev-hello',
        logStreamName: '2019/05/16/[$LATEST]8bcc747eb4ff4897bf6eba48797c0d73',
        traceId: {
          Parent: '28effe37598bb622',
          Root: '1-5cdcf03a-64a1b06067c2100c52e51ef4',
          Sampled: '0',
          transactionId: '64a1b06067c2100c52e51ef4',
        },
        tracer: {
          name: '@lumigo/tracerMock',
          version: '1.2.3',
        },
      },
      memoryAllocated: '1024',
      messageVersion: 2,
      parentId: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf',
      readiness: 'cold',
      region: 'us-east-1',
      invokedArn:
        'arn:aws:lambda:us-east-1:985323015126:function:aws-nodejs-dev-hello',
      invokedVersion: '1',
      runtime: 'AWS_Lambda_nodejs8.10',
      service: 'external',
      started: 1234,
      token: '',
      transactionId: '64a1b06067c2100c52e51ef4',
      type: 'http',
      vendor: 'AWS',
      version: '$LATEST',
    };
  }
  withSpanId = spanId => {
    this._span.id = spanId;
    return this;
  };

  withResponse = response => {
    this._span.info.httpInfo.response = response;
    this._span.info.httpInfo.response.headers = stringifyAndPrune(
      lowerCaseObjectKeys(this._span.info.httpInfo.response.headers)
    );
    this._span.info.httpInfo.response.body = stringifyAndPrune(
      this._span.info.httpInfo.response.body
    );
    return this;
  };

  withRequest = request => {
    this._span.info.httpInfo.request = request;
    this._span.info.httpInfo.request.headers = stringifyAndPrune(
      this._span.info.httpInfo.request.headers
    );
    this._span.info.httpInfo.request.body = stringifyAndPrune(
      this._span.info.httpInfo.request.body
    );
    return this;
  };

  withToken = token => {
    this._span.token = token;
    return this;
  };

  withInvokedArn = invokedArn => {
    this._span.invokedArn = invokedArn;
    return this;
  };

  withParentId = parentId => {
    this._span.parentId = parentId;
    return this;
  };

  withAccountId = accountId => {
    this._span.account = accountId;
    return this;
  };

  withEnded = ended => {
    this._span.ended = ended;
    return this;
  };

  withStarted = started => {
    this._span.started = started;
    return this;
  };

  withInfo = info => {
    this._span.info = info;
    return this;
  };

  withRandomResponse = () => {
    return this.withResponse({
      body: '"Well, Tony is dead."',
      headers: '{"Peter":"Parker"}',
      receivedTime: 1256,
      statusCode: 200,
    });
  };

  build = () => this._span;
}
