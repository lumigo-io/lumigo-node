import { HttpInfo } from './httpSpan';
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
export interface GenericSpan {
    id: string;
    [key: string]: any;
}
export interface BasicSpan extends GenericSpan {
    id: string;
    info: SpanInfo | {
        httpInfo: HttpInfo;
    };
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
export interface BasicChildSpan extends BasicSpan {
    type: string;
    parentId: string;
    reporterAwsRequestId: string;
}
