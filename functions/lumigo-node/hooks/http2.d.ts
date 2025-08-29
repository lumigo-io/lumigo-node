import { RequestData } from './baseHttp';
import { BasicChildSpan } from '../types/spans/basicSpan';
export declare class Http2 {
    static http2RequestArguments(args: any[]): {
        url?: string;
        options?: any;
        callback?: Function;
    };
    static http2AfterConnectWrapper(args: any, originalFnResult: any): void;
    static http2StreamEmitBeforeHookWrapper(transactionId: string, awsRequestId: string, requestData: RequestData, requestRandomId: string, currentSpan: BasicChildSpan): (args: any[]) => void;
    static wrapHttp2Lib(http2Lib: any): void;
    static hookHttp2(): void;
}
