import { MongoDBSpan } from '../types/spans/mongoDBSpan';
export declare const createMongoDbSpan: (transactionId: string, awsRequestId: string, spanId: string, requestMetadata: any, mongoFields: any) => MongoDBSpan;
export declare const extendMongoDbSpan: (currentSpan: any, extendData: any) => any;
