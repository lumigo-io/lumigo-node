export namespace LOG_LEVELS {
    let INFO: string;
    let WARNING: string;
    let FATAL: string;
    let DEBUG: string;
}
export namespace LogStore {
    export { addLog };
    export { clean };
}
export function info(msg: any, obj?: any): void;
export function warn(msg: any, obj?: any): void;
export function fatal(msg: any, obj?: any): void;
export function debug(msg: any, obj?: any): void;
export function log(levelname: any, message: any, obj: any): void;
export function warnClient(msg: any, obj: any): boolean;
export const internalAnalyticsMessage: Function;
declare function addLog(type: any, message: any, object: any): void;
declare function clean(): void;
export {};
