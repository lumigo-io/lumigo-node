export declare const TRACEPARENT_HEADER_NAME = "traceparent";
export declare const TRACESTATE_HEADER_NAME = "tracestate";
export declare const SKIP_INJECT_HEADERS: string[];
export declare const shouldSkipTracePropagation: (headers: Record<string, string>) => boolean;
export declare const getW3CTracerPropagatorAdditionalHeaders: (headers: Record<string, string>) => Record<string, string>;
export declare const addW3CTracePropagator: (headers: Record<string, string>) => Record<string, string>;
export declare const getW3CMessageId: (headers: Record<string, string>) => string | null;
