export declare const createPrismaSpan: (transactionId: any, awsRequestId: any, spanId: any, requestMetadata: any, prismaFields: any) => {
    started: any;
    model: any;
    operation: any;
    queryArgs: any;
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
export declare const extendedPrismaSpan: (prismaSpan: any, extendedFields: any) => any;
