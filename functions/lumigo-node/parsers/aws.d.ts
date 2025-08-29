export declare const dynamodbParser: (requestData: any) => {
    awsServiceData: {
        resourceName: any;
        dynamodbMethod: any;
        messageId: string;
    };
};
export declare const isArn: (arnToValidate: any) => any;
export declare const extractLambdaNameFromArn: (arn: any) => any;
export declare const lambdaParser: (requestData: any, responseData: any) => {
    awsServiceData?: undefined;
    spanId?: undefined;
} | {
    awsServiceData: {
        resourceName: string;
        invocationType: any;
    };
    spanId: any;
};
export declare const snsParser: (requestData: any, responseData: any) => {
    awsServiceData?: undefined;
} | {
    awsServiceData: {
        resourceName: any;
        targetArn: any;
        messageId: any;
    };
};
export declare const apigwParser: (requestData: any, responseData: any) => {
    awsServiceData?: undefined;
} | {
    awsServiceData: {
        messageId: any;
    };
};
export declare const eventBridgeParser: (requestData: any, responseData: any) => {
    awsServiceData: {
        resourceNames: unknown[];
        messageIds: any;
    };
};
export declare const sqsParser: (requestData: any, responseData: any) => {
    awsServiceData: {};
};
export declare const kinesisParser: (requestData: any, responseData: any) => {
    awsServiceData: {
        resourceName: any;
    };
};
export declare const defaultParser: (requestData: any, responseData: any) => {
    awsServiceData?: undefined;
} | {
    awsServiceData: {
        messageId: any;
    };
};
