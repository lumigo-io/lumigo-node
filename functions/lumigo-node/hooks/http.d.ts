import { BasicChildSpan } from '../types/spans/basicSpan';
export type Agent = {
    defaultPort: number;
};
export declare class Http {
    static httpRequestArguments(args: any[]): {
        url?: string;
        options?: any;
        callback?: Function;
    };
    static addOptionsToHttpRequestArguments(originalArgs: any, newOptions: any): void;
    static httpBeforeRequestWrapper(args: any, extenderContext: any): void;
    static httpAfterRequestWrapper(args: any, originalFnResult: any, extenderContext: any): void;
    static addStepFunctionEvent(messageId: string): void;
    static wrapHttpLib(httpLib: any): void;
    static hookHttp(): void;
    static createEmitResponseHandler(transactionId: string, awsRequestId: string, requestData: {
        body: string;
    }, requestRandomId: string): (response: {
        headers: {};
        statusCode: number;
    }) => void;
    static httpRequestEmitBeforeHookWrapper(transactionId: string, awsRequestId: string, requestData: {
        body: string;
    }, requestRandomId: string, currentSpan: BasicChildSpan): (args: any[]) => void;
}
