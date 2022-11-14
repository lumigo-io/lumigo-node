import { getChainedServicesMaxDepth, getChainedServicesMaxWidth, safeExecute } from '../utils';
import type { EventInfo, IncomingEvent, Trigger } from './event-data.types';
import { ApiGatewayEventParser } from './trigger-parsers/api-gateway-parser';
import { AppSyncEventParser } from './trigger-parsers/appsync-parser';
import { DynamodbEventParser } from './trigger-parsers/dynamodb-parser';
import { EventBridgeEventParser } from './trigger-parsers/event-bridge-parser';
import { KinesisEventParser } from './trigger-parsers/kinesis-parser';
import { S3EventParser } from './trigger-parsers/s3-parser';
import { SnsEventParser } from './trigger-parsers/sns-parser';
import { SqsEventParser } from './trigger-parsers/sqs-parser';
import { StepFunctionEventParser } from './trigger-parsers/step-function-parser';
import * as logger from '../logger';
import { EventTriggerParser } from './trigger-parsers/trigger-parser-base';

const EVENT_TRIGGER_PARSERS: Array<EventTriggerParser> = [
  new ApiGatewayEventParser(),
  new AppSyncEventParser(),
  new DynamodbEventParser(),
  new EventBridgeEventParser(),
  new KinesisEventParser(),
  new S3EventParser(),
  new SnsEventParser(),
  new SqsEventParser(),
  new StepFunctionEventParser(),
];
export const INNER_MESSAGES_MAGIC_PATTERN = new RegExp(
  '(' +
    EVENT_TRIGGER_PARSERS.map((parser) => parser.MAGIC_IDENTIFIER)
      .filter((x) => !!x)
      .join('|') +
    ')'
);

const recursiveParseTriggers = (
  event: IncomingEvent,
  targetId: string | null,
  level: number
): Trigger[] => {
  return (
    safeExecute(() => {
      if (level > getChainedServicesMaxDepth()) {
        logger.info('Chained services parsing has stopped due to depth');
        return [];
      }
      return EVENT_TRIGGER_PARSERS.filter((parser) => parser.shouldHandle(event))
        .map((parser) => {
          const trigger = parser.handle(event, targetId);
          let innerMessages = parser.extractInner(event);
          if (innerMessages.length > getChainedServicesMaxWidth()) {
            logger.info('Chained services parsing has stopped due to width');
            innerMessages = innerMessages.slice(0, getChainedServicesMaxWidth());
          }

          const innerTriggers =
            safeExecute(() =>
              innerMessages
                .filter((message) => message.search(INNER_MESSAGES_MAGIC_PATTERN) !== -1)
                .map((innerEvent) =>
                  recursiveParseTriggers(JSON.parse(innerEvent), trigger.id, level + 1)
                )
                .flat()
            )() || [];
          return [trigger, ...innerTriggers];
        })
        .flat();
    })() || []
  );
};

export const getEventInfo = (event: IncomingEvent): EventInfo => {
  const triggers = safeExecute(() => recursiveParseTriggers(event, null, 0))();

  return { trigger: triggers };
};
