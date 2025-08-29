export function info(message: any, { type, extra }?: {
    type?: string;
    extra?: {};
}): void;
export function warn(message: any, { type, extra }?: {
    type?: string;
    extra?: {};
}): void;
export function error(message: any, { extra, err, type }?: {
    extra?: {};
    err?: any;
    type?: any;
}): void;
