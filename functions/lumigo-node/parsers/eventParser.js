import { getEnvVarAsList, isScrubKnownServicesOn } from '../utils';
const clone = require('rfdc')();
const API_GW_KEYS_ORDER = getEnvVarAsList('LUMIGO_API_GW_KEYS_ORDER', [
    'version',
    'routeKey',
    'rawPath',
    'rawQueryString',
    'resource',
    'path',
    'httpMethod',
    'queryStringParameters',
    'pathParameters',
    'body',
    'requestContext',
    'headers',
]);
const API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS = getEnvVarAsList('LUMIGO_API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS', ['cookie', 'x-amz', 'accept', 'cloudfront', 'via', 'x-forwarded', 'sec-']);
const API_GW_REQUEST_CONTEXT_FILTER_KEYS = getEnvVarAsList('LUMIGO_API_GW_REQUEST_CONTEXT_FILTER_KEYS', ['authorizer', 'http', 'requestid']);
const API_GW_KEYS_DELETE_KEYS = getEnvVarAsList('LUMIGO_API_GW_KEYS_DELETE_KEYS', [
    'multiValueHeaders',
    'multiValueQueryStringParameters',
]);
const SQS_KEYS_ORDER = getEnvVarAsList('LUMIGO_SQS_KEYS_ORDER', [
    'body',
    'messageAttributes',
    'messageId',
]);
const SNS_KEYS_ORDER = getEnvVarAsList('LUMIGO_SNS_KEYS_ORDER', [
    'Message',
    'MessageAttributes',
    'MessageId',
]);
const S3_KEYS_ORDER = getEnvVarAsList('LUMIGO_S3_KEYS_ORDER', [
    'awsRegion',
    'eventTime',
    'eventName',
    'userIdentity',
    'requestParameters',
]);
const S3_BUCKET_KEYS_ORDER = getEnvVarAsList('LUMIGO_S3_OBJECT_KEYS_ORDER', ['arn']);
const S3_OBJECT_KEYS_ORDER = getEnvVarAsList('LUMIGO_S3_OBJECT_KEYS_ORDER', ['key', 'size']);
const CLOUDFRONT_KEYS_ORDER = getEnvVarAsList('LUMIGO_CLOUDFRONT_KEYS_ORDER', ['config']);
const CLOUDFRONT_REQUEST_KEYS_ORDER = getEnvVarAsList('LUMIGO_CLOUDFRONT_REQUEST_KEYS_ORDER', [
    'body',
    'clientIp',
    'method',
    'querystring',
    'uri',
]);
export const isApiGwEvent = (event) => {
    var _a, _b;
    return ((_a = event === null || event === void 0 ? void 0 : event.requestContext) === null || _a === void 0 ? void 0 : _a.domainName) != null && ((_b = event === null || event === void 0 ? void 0 : event.requestContext) === null || _b === void 0 ? void 0 : _b.requestId) != null;
};
export const isSnsEvent = (event) => {
    var _a, _b;
    return ((_b = (_a = event === null || event === void 0 ? void 0 : event.Records) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.EventSource) === 'aws:sns';
};
export const isSqsEvent = (event) => {
    var _a, _b;
    return ((_b = (_a = event === null || event === void 0 ? void 0 : event.Records) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.eventSource) === 'aws:sqs';
};
export const isS3Event = (event) => {
    var _a, _b;
    return ((_b = (_a = event === null || event === void 0 ? void 0 : event.Records) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.eventSource) === 'aws:s3';
};
const isDDBEvent = (event) => {
    var _a, _b;
    return ((_b = (_a = event === null || event === void 0 ? void 0 : event.Records) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.eventSource) === 'aws:dynamodb';
};
export const isCloudfrontEvent = (event) => {
    var _a, _b, _c, _d;
    return ((_d = (_c = (_b = (_a = event === null || event === void 0 ? void 0 : event.Records) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.cf) === null || _c === void 0 ? void 0 : _c.config) === null || _d === void 0 ? void 0 : _d.distributionId) != null;
};
export const parseApiGwEvent = (event) => {
    const parsedEvent = {};
    // Add order keys
    for (const orderKey of API_GW_KEYS_ORDER) {
        if (event[orderKey] != null) {
            parsedEvent[orderKey] = event[orderKey];
        }
    }
    // Remove requestContext keys
    if (event.requestContext != null) {
        parsedEvent['requestContext'] = {};
        for (const rcKey of Object.keys(event.requestContext)) {
            if (API_GW_REQUEST_CONTEXT_FILTER_KEYS.includes(rcKey.toLowerCase())) {
                parsedEvent['requestContext'][rcKey] = event['requestContext'][rcKey];
            }
        }
    }
    // Remove headers keys
    if (event.headers != null) {
        parsedEvent['headers'] = {};
        for (const hKey of Object.keys(event.headers)) {
            if (API_GW_PREFIX_KEYS_HEADERS_DELETE_KEYS.find((v) => hKey.toLowerCase().startsWith(v)) == null) {
                parsedEvent['headers'][hKey] = event['headers'][hKey];
            }
        }
    }
    // Add all other keys
    for (const key of Object.keys(event)) {
        if (!API_GW_KEYS_ORDER.includes(key) && !API_GW_KEYS_DELETE_KEYS.includes(key)) {
            parsedEvent[key] = event[key];
        }
    }
    return parsedEvent;
};
export const parseSnsEvent = (event) => {
    const newSnsEvent = {};
    newSnsEvent['Records'] = [];
    // Add order keys
    for (const rec of event['Records']) {
        const newSnsRecordEvent = {};
        for (const key of SNS_KEYS_ORDER) {
            if (rec.Sns != null && rec.Sns[key] != null) {
                newSnsRecordEvent[key] = rec.Sns[key];
            }
        }
        newSnsEvent['Records'].push({ Sns: newSnsRecordEvent });
    }
    return newSnsEvent;
};
export const parseSqsEvent = (event) => {
    const newSqsEvent = {};
    newSqsEvent['Records'] = [];
    // Add order keys
    for (const rec of event['Records']) {
        const newSqsRecordEvent = {};
        for (const key of SQS_KEYS_ORDER) {
            if ((rec === null || rec === void 0 ? void 0 : rec[key]) != null) {
                newSqsRecordEvent[key] = rec[key];
            }
        }
        newSqsEvent['Records'].push(newSqsRecordEvent);
    }
    return newSqsEvent;
};
export const parseS3Event = (event) => {
    var _a;
    const newS3Event = {
        Records: [],
    };
    // Add order keys
    for (const rec of event['Records']) {
        const newS3RecordEvent = {};
        for (const key of S3_KEYS_ORDER) {
            if ((rec === null || rec === void 0 ? void 0 : rec[key]) !== undefined) {
                newS3RecordEvent[key] = rec[key];
            }
        }
        if (((_a = rec === null || rec === void 0 ? void 0 : rec.s3) === null || _a === void 0 ? void 0 : _a.bucket) !== undefined) {
            newS3RecordEvent.s3 = {
                bucket: {},
                object: {},
            };
            for (const key of S3_OBJECT_KEYS_ORDER) {
                newS3RecordEvent.s3.object[key] = rec.s3.object[key];
            }
            for (const key of S3_BUCKET_KEYS_ORDER) {
                newS3RecordEvent.s3.bucket[key] = rec.s3.bucket[key];
            }
        }
        newS3Event['Records'].push(newS3RecordEvent);
    }
    return newS3Event;
};
export const parseCloudfrontEvent = (event) => {
    var _a;
    const newCloudfrontEvent = {
        Records: [],
    };
    // Add order keys
    for (const rec of event['Records']) {
        const cfRecord = rec['cf'] || {};
        const newCloudfrontRecordEvent = { cf: {} };
        for (const key of CLOUDFRONT_KEYS_ORDER) {
            if ((cfRecord === null || cfRecord === void 0 ? void 0 : cfRecord[key]) !== undefined) {
                newCloudfrontRecordEvent.cf[key] = cfRecord[key];
            }
        }
        if ((cfRecord === null || cfRecord === void 0 ? void 0 : cfRecord.request) !== undefined) {
            newCloudfrontRecordEvent.cf.request = {};
            for (const key of CLOUDFRONT_REQUEST_KEYS_ORDER) {
                if (((_a = cfRecord.request) === null || _a === void 0 ? void 0 : _a[key]) !== undefined) {
                    newCloudfrontRecordEvent.cf.request[key] = cfRecord.request[key];
                }
            }
        }
        newCloudfrontEvent['Records'].push(newCloudfrontRecordEvent);
    }
    return newCloudfrontEvent;
};
export const parseEvent = (awsEvent) => {
    const event = clone(awsEvent);
    if (isApiGwEvent(event)) {
        return parseApiGwEvent(event);
    }
    if (isSnsEvent(event)) {
        return parseSnsEvent(event);
    }
    if (isSqsEvent(event)) {
        return parseSqsEvent(event);
    }
    if (isS3Event(event)) {
        return parseS3Event(event);
    }
    if (isCloudfrontEvent(event)) {
        return parseCloudfrontEvent(event);
    }
    return event;
};
export const getSkipScrubPath = (event) => {
    if (isScrubKnownServicesOn()) {
        return null;
    }
    if (isS3Event(event)) {
        return ['Records', [], 's3', 'object', 'key'];
    }
    if (isDDBEvent(event)) {
        return ['Records', [], 'dynamodb', 'Keys'];
    }
    return null;
};
