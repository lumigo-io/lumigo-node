export function createNeo4jSpan(transactionId: any, awsRequestId: any, spanId: any, requestMetadata: any, dbFields: any, spanType: any): {
    started: any;
    connectionParameters: any;
    query: any;
    params: any;
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
export function extendNeo4jSpan(currentSpan: any, extendData: any): any;
