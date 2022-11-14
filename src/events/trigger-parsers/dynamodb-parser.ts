import { IncomingEvent, Trigger } from '../event-data.types';
import { EventTriggerParser } from './trigger-parser-base';
import { getRandomId, md5Hash } from '../../utils';
import { EventTrigger } from '../event-trigger.enum';

export class DynamodbEventParser extends EventTriggerParser {
  _shouldHandle = (event: IncomingEvent): boolean => {
    return event?.Records?.[0]?.eventSource === 'aws:dynamodb';
  };

  handle = (event: IncomingEvent, targetId: string | null): Trigger => {
    const arn = event.Records[0].eventSourceARN;
    const approxEventCreationTime = event.Records[0].dynamodb.ApproximateCreationDateTime * 1000;
    const messageIds = event.Records.map((record) => {
      if (['MODIFY', 'REMOVE'].includes(record.eventName) && record?.dynamodb?.Keys) {
        return md5Hash(record.dynamodb.Keys);
      } else if (record.eventName === 'INSERT' && record.dynamodb && record.dynamodb.NewImage) {
        return md5Hash(record.dynamodb.NewImage);
      }
    }).filter((hashedRecordContent) => hashedRecordContent != null);
    return {
      id: getRandomId(),
      targetId: targetId,
      triggeredBy: EventTrigger.DynamoDB,
      fromMessageIds: messageIds,
      extra: {
        arn,
        approxEventCreationTime,
      },
    };
  };
}
