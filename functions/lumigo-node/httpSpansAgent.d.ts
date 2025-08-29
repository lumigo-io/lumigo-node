export namespace HttpSpansAgent {
    export { postSpans };
    export { cleanSessionInstance };
    export { initAgent };
}
declare function postSpans(requestBody: any): Promise<void>;
declare function cleanSessionInstance(): void;
declare function initAgent(): void;
export {};
