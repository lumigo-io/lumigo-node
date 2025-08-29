import { BasicSpan } from './basicSpan';
export type Vendor = 'AWS';
export interface MongoDBSpan extends BasicSpan {
    started: number;
    databaseName: string;
    commandName: string;
    mongoRequestId: string;
    mongoOperationId: string;
    mongoConnectionId: string;
    request: string;
}
