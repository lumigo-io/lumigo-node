export declare const createSqlSpan: (transactionId: any, awsRequestId: any, spanId: any, requestMetadata: any, dbFields: any, spanType: any) => {
    started: any;
    connectionParameters: {
        host: any;
        port: any;
        database: any;
        user: any;
    };
    query: string;
    values: any;
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
export declare const extendSqlSpan: (currentSpan: any, extendData: any) => any;
