import { GenericSpan } from './types/spans/basicSpan';
export declare const NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION = 200;
export declare const MAX_SPANS_BULK_SIZE = 200;
export declare const sendSingleSpan: (span: GenericSpan, addEnrichmentSpan?: boolean) => Promise<void>;
export declare const logSpans: (rtt: number, spans: any) => void;
export declare const isSpansContainsErrors: (spans: any) => boolean;
export declare const sendSpans: (spans: any[], addEnrichmentSpan?: boolean) => Promise<void>;
export declare function scrubSpans(resultSpans: any[]): any[];
export declare function getPrioritizedSpans(spans: any[], maxSendBytes: number): any[];
export declare function splitAndZipSpans(spans: any[]): string[];
/**
 * Add or create an enrichment span to the given list of spans, with overall span count information.
 * @param {GenericSpan[]} spans List of spans to add to
 * @returns {GenericSpan[]} The given list, with an enrichment span added / modified with the span counts
 */
export declare const addOrUpdateEnrichmentSpan: (spans: GenericSpan[]) => GenericSpan[];
export declare const forgeAndScrubRequestBody: (spans: any[], maxSendBytes: number, maxSendBytesOnError: number, shouldTryZip?: boolean, addEnrichmentSpan?: boolean) => string | string[] | undefined;
