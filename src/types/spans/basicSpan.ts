export type Vendor = 'AWS';

export interface SpanInfo {
  traceId: any;
  tracer: {
    name: string;
    version: string;
  };
  logGroupName: string;
  logStreamName: string;
}

export interface BasicSpan {
  info: SpanInfo;
  vendor: Vendor;
  transactionId: string;
  account: string;
  memoryAllocated: string;
  version: string;
  runtime: string;
  readiness: string;
  messageVersion: number;
  token: string;
  region: string;
  invokedArn: string;
  invokedVersion: string;
}
