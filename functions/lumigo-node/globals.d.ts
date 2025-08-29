import type { TracerOptions } from './tracer';
import type { LambdaContext } from './types/aws/awsEnvironment';
import { GenericSpan } from './types/spans/basicSpan';
export declare const DEFAULT_MAX_SIZE_FOR_REQUEST: number;
export declare const DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR: number;
export declare const DEFAULT_MAX_SIZE_FOR_SPANS_STORED_IN_MEMORY: number;
export declare const MAX_TRACER_ADDED_DURATION_ALLOWED = 750;
export declare const MIN_TRACER_ADDED_DURATION_ALLOWED = 200;
export declare enum DroppedSpanReasons {
    SPANS_STORED_IN_MEMORY_SIZE_LIMIT = "SPANS_STORED_IN_MEMORY_SIZE_LIMIT",
    SPANS_SENT_SIZE_LIMIT = "SPANS_SENT_SIZE_LIMIT",
    INVOCATION_MAX_LATENCY_LIMIT = "INVOCATION_MAX_LATENCY_LIMIT"
}
export type DroppedSpansData = {
    drops: number;
};
export declare class SpansContainer {
    private static spans;
    private static currentSpansSize;
    private static totalSpans;
    private static droppedSpansReasons;
    static addSpan(span: GenericSpan, ignoreSizeLimits?: boolean): boolean;
    static recordDroppedSpan(reason: DroppedSpanReasons, incrementTotalSpansCounter?: boolean, numOfDroppedSpans?: number): void;
    static getDroppedSpansReasons(): {
        [reason: string]: DroppedSpansData;
    };
    static getSpans(): GenericSpan[];
    static getSpanById(spanId: string): GenericSpan | null;
    static changeSpanId(oldId: string, newId: string): void;
    static clearSpans(): void;
    static getTotalSpans(): number;
}
export declare const GlobalTimer: {
    setGlobalTimeout: (func: any, duration: any) => void;
    clearTimer: () => void;
};
export declare const ExecutionTags: {
    addTag: (key: any, value: any, shouldLogErrors?: boolean) => boolean;
    getTags: () => any[];
    clear: () => any[];
    validateTag: (key: any, value: any, shouldLogErrors?: boolean) => boolean;
    autoTagEvent: (event: any) => void;
};
export declare const TracerGlobals: {
    getTracerInputs: () => {
        token: string;
        debug: boolean;
        edgeHost: string;
        switchOff: boolean;
        isStepFunction: boolean;
        maxSizeForRequest: number;
        maxSizeForRequestOnError: number;
        maxSizeForStoredSpansInMemory: number;
        lambdaTimeout: number;
    };
    setTracerInputs: ({ token, debug, edgeHost, switchOff, stepFunction, maxSizeForRequest, maxSizeForRequestOnError, lambdaTimeout, maxSizeForStoredSpansInMemory, }: TracerOptions) => void;
    setHandlerInputs: ({ event, context }: {
        event: any;
        context: any;
    }) => {
        event: {};
        context: LambdaContext | {};
    } & {
        event: any;
        context: any;
    };
    getHandlerInputs: () => {
        event: {};
        context: LambdaContext | any;
    };
    getLambdaTimeout: () => number;
    clearTracerInputs: () => {
        token: string;
        debug: boolean;
        edgeHost: string;
        switchOff: boolean;
        isStepFunction: boolean;
        maxSizeForRequest: number;
        maxSizeForRequestOnError: number;
        maxSizeForStoredSpansInMemory: number;
        lambdaTimeout: number;
    } & {
        token: string;
        debug: boolean;
        edgeHost: string;
        switchOff: boolean;
        isStepFunction: boolean;
        maxSizeForRequest: number;
        maxSizeForRequestOnError: number;
        maxSizeForStoredSpansInMemory: number;
    };
    clearHandlerInputs: () => {
        event: {};
        context: LambdaContext | {};
    } & {
        event: {};
        context: {};
    };
};
export declare const clearGlobals: () => void;
