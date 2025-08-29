export function createRedisSpan(transactionId: any, awsRequestId: any, spanId: any, requestMetadata: any, redisFields: any): {
    started: any;
    requestCommand: any;
    requestArgs: any;
    connectionOptions: any;
    type: string;
    parentId: string;
    reporterAwsRequestId: string;
    id: string;
    info: import("../types/spans/basicSpan").SpanInfo | {
        httpInfo: import("../types/spans/httpSpan").HttpInfo;
    };
    vendor: import("../types/spans/basicSpan").Vendor;
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
};
export function extendRedisSpan(currentSpan: any, extendData: any): any;
