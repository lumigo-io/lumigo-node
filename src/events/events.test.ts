import * as exampleS3Event from '../../testUtils/testdata/events/s3-event.json';
import * as exampleSnsEvent from '../../testUtils/testdata/events/sns-event.json';
import * as exampleSesEvent from '../../testUtils/testdata/events/ses-event.json';
import * as exampleSqsEvent from '../../testUtils/testdata/events/sqs-event.json';
import * as exampleSnsSqsEvent from '../../testUtils/testdata/events/sns-sqs-event.json';
import * as exampleTwoSnsSqsEvent from '../../testUtils/testdata/events/two-sns-sqs-event.json';
import * as exampleSqsNonSnsEvent from '../../testUtils/testdata/events/sqs-non-sns-event.json';
import * as exampleEventBridgeSqsEvent from '../../testUtils/testdata/events/eventbridge-sqs-event.json';
import * as exampleSqsManyMessagesEvent from '../../testUtils/testdata/events/sqs-event-many-messages.json';
import * as exampleKinesisEvent from '../../testUtils/testdata/events/kinesis-event.json';
import * as exampleDynamoDBInsertEvent from '../../testUtils/testdata/events/dynamodb-insert-event.json';
import * as exampleDynamoDBModifyEvent from '../../testUtils/testdata/events/dynamodb-modify-event.json';
import * as exampleDynamoDBRemoveEvent from '../../testUtils/testdata/events/dynamodb-remove-event.json';
import * as exampleApiGatewayEvent from '../../testUtils/testdata/events/apigw-request.json';
import * as exampleFalseApiGatewayEvent from '../testdata/events/false-apigw-request.json';
import * as exampleApiGatewayV2Event from '../../testUtils/testdata/events/apigw-v2-event.json';
import * as exampleUnsupportedEvent from '../../testUtils/testdata/events/appsync-invoke.json';
import * as exampleApiGatewayEventWithoutHost from '../../testUtils/testdata/events/apigw-custom-auth-request.json';
import * as exampleEventBridgeEvent from '../../testUtils/testdata/events/event-bridge-event.json';
import * as exampleAppSyncEvent from '../../testUtils/testdata/events/appsync-event.json';
import * as exampleAppSyncSecondEvent from '../../testUtils/testdata/events/appsync-second-event.json';
import * as exampleEmptySqsEvent from '../../testUtils/testdata/events/empty-sqs-event.json';
import * as utils from '../utils';
import {
  getChainedServicesMaxDepth,
  getChainedServicesMaxWidth,
  getRandomId,
  md5Hash,
} from '../utils';
import { TracerGlobals } from '../globals';
import * as events from './events';
import { EventTrigger } from './event-trigger.enum';
import { getEventInfo, INNER_MESSAGES_MAGIC_PATTERN } from './events';
import { EventTriggerParser } from './trigger-parsers/trigger-parser-base';
import { IncomingEvent, Trigger } from './event-data.types';

describe('events', () => {
  test('getTriggeredBy', () => {
    const getTriggeredBy = (exampleEvent: any) =>
      getEventInfo(exampleEvent).trigger?.[0]?.triggeredBy;
    expect(getTriggeredBy(exampleS3Event)).toEqual(EventTrigger.S3);
    expect(getTriggeredBy(exampleSnsEvent)).toEqual(EventTrigger.SNS);
    expect(getTriggeredBy(exampleKinesisEvent)).toEqual(EventTrigger.Kinesis);
    expect(getTriggeredBy(exampleApiGatewayEvent)).toEqual(EventTrigger.ApiGateway);
    expect(getTriggeredBy(exampleFalseApiGatewayEvent)).toEqual(undefined);
    expect(getTriggeredBy(exampleDynamoDBInsertEvent)).toEqual(EventTrigger.DynamoDB);
    expect(getTriggeredBy(exampleEventBridgeEvent)).toEqual(EventTrigger.EventBridge);
    expect(getTriggeredBy(exampleAppSyncEvent)).toEqual(EventTrigger.AppSync);
    expect(getTriggeredBy(exampleAppSyncSecondEvent)).toEqual(EventTrigger.AppSync);
    expect(getTriggeredBy(exampleUnsupportedEvent)).toEqual(undefined);
    expect(getTriggeredBy(exampleEmptySqsEvent)).toEqual(undefined);
  });

  const getTestableTrigger = (event) => {
    return events.getEventInfo(event)?.trigger?.map((t) => {
      delete t.id;
      delete t.targetId;
      return t;
    });
  };

  test('getApiGatewayData', () => {
    // @ts-ignore TODO: fix the example file to fit the API Gateway event type definition
    expect(getTestableTrigger(exampleApiGatewayEvent)).toEqual([
      {
        triggeredBy: EventTrigger.ApiGateway,
        fromMessageIds: ['deef4878-7910-11e6-8f14-25afc3e9ae33'],
        extra: {
          api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
          httpMethod: 'POST',
          resource: '/{proxy+}',
          stage: 'testStage',
        },
      },
    ]);

    // @ts-ignore TODO: fix the example file to fit the API Gateway event type definition
    expect(getTestableTrigger(exampleApiGatewayEventWithoutHost)).toEqual([
      {
        triggeredBy: EventTrigger.ApiGateway,
        fromMessageIds: [],
        extra: {
          api: null,
          httpMethod: undefined,
          resource: undefined,
          stage: '$default',
        },
      },
    ]);
  });

  test('getApiGatewayData => API gw v2', () => {
    // @ts-ignore TODO: fix the example file to fit the API Gateway v2 event type definition
    expect(getTestableTrigger(exampleApiGatewayV2Event)).toEqual([
      {
        triggeredBy: EventTrigger.ApiGateway,
        fromMessageIds: ['JKJaXmPLvHcESHA='],
        extra: {
          api: 'r3pmxmplak.execute-api.us-east-2.amazonaws.com',
          httpMethod: 'GET',
          resource: '/default/nodejs-apig-function-1G3XMPLZXVXYI',
          stage: 'default',
        },
      },
    ]);
  });

  test('getSnsData', () => {
    expect(getTestableTrigger(exampleSnsEvent)).toEqual([
      {
        triggeredBy: EventTrigger.SNS,
        fromMessageIds: ['95df01b4-ee98-5cb9-9903-4c221d41eb5e'],
        extra: {
          arn: 'arn:aws:sns:EXAMPLE',
        },
      },
    ]);
  });

  test('getRelevantEventData', () => {
    expect(getTestableTrigger(exampleSqsEvent)).toEqual([
      {
        triggeredBy: EventTrigger.SQS,
        fromMessageIds: ['MessageID_1'],
        extra: {
          arn: 'arn:aws:sqs:us-west-2:123456789012:SQSQueue',
        },
      },
    ]);

    expect(getTestableTrigger(exampleSqsManyMessagesEvent)).toEqual([
      {
        triggeredBy: EventTrigger.SQS,
        fromMessageIds: ['MessageID_1', 'MessageID_2'],
        extra: {
          arn: 'arn:aws:sqs:us-west-2:123456789012:SQSQueue',
        },
      },
    ]);

    expect(getTestableTrigger(exampleSnsSqsEvent)).toEqual([
      {
        triggeredBy: EventTrigger.SQS,
        fromMessageIds: ['f4ceb23d-2ae7-44d3-b171-df7ab2d10a81'],
        extra: {
          arn: 'arn:aws:sqs:us-east-1:123456789:sqs-queue-name',
        },
      },
      {
        triggeredBy: EventTrigger.SNS,
        fromMessageIds: ['2c78f253-4cd9-57bb-8bc3-a965e40a293e'],
        extra: {
          arn: 'arn:aws:sns:us-west-2:723663554526:tracer-test-saart-temp-Pttcj',
        },
      },
    ]);

    expect(getTestableTrigger(exampleSqsNonSnsEvent)).toEqual([
      {
        triggeredBy: EventTrigger.SQS,
        fromMessageIds: ['f4ceb23d-2ae7-44d3-b171-df7ab2d10a81'],
        extra: {
          arn: 'arn:aws:sqs:us-east-1:123456789:sqs-queue-name',
        },
      },
    ]);

    expect(getTestableTrigger(exampleKinesisEvent)).toEqual([
      {
        triggeredBy: EventTrigger.Kinesis,
        fromMessageIds: [
          '49568167373333333333333333333333333333333333333333333333',
          '49568167373333333334444444444444444444444444444444444444',
        ],
        extra: {
          arn: 'arn:aws:kinesis:us-east-1:123456789012:stream/simple-stream',
        },
      },
    ]);

    expect(getTestableTrigger(exampleDynamoDBInsertEvent)).toEqual([
      {
        triggeredBy: EventTrigger.DynamoDB,
        fromMessageIds: [
          md5Hash({
            val: { S: 'data' },
            asdf1: { B: 'AAEqQQ==' },
            asdf2: { BS: ['AAEqQQ==', 'QSoBAA=='] },
            key: { S: 'binary' },
          }),
          'fa2800aae04015828d3b0acef25db799',
        ],
        extra: {
          arn: 'arn:aws:dynamodb:us-east-1:123456789012:table/Example-Table/stream/2016-12-01T00:00:00.000',
          approxEventCreationTime: 1480642020000,
        },
      },
    ]);

    expect(getTestableTrigger(exampleDynamoDBModifyEvent)).toEqual([
      {
        triggeredBy: EventTrigger.DynamoDB,
        fromMessageIds: [md5Hash({ key: { N: '8' } })],
        extra: {
          arn: 'arn:aws:dynamodb:us-west-2:723663554526:table/abbbbb/stream/2020-05-25T12:04:49.788',
          approxEventCreationTime: 1590509701000,
        },
      },
    ]);

    expect(getTestableTrigger(exampleDynamoDBRemoveEvent)).toEqual([
      {
        triggeredBy: EventTrigger.DynamoDB,
        fromMessageIds: [md5Hash({ key: { N: '123' } })],
        extra: {
          arn: 'arn:aws:dynamodb:us-west-2:723663554526:table/abbbbb/stream/2020-05-25T12:04:49.788',
          approxEventCreationTime: 1590509672000,
        },
      },
    ]);

    expect(getTestableTrigger(exampleSnsEvent)).toEqual([
      {
        triggeredBy: EventTrigger.SNS,
        fromMessageIds: ['95df01b4-ee98-5cb9-9903-4c221d41eb5e'],
        extra: {
          arn: 'arn:aws:sns:EXAMPLE',
        },
      },
    ]);

    expect(getTestableTrigger(exampleS3Event)).toEqual([
      {
        triggeredBy: EventTrigger.S3,
        fromMessageIds: ['C3D13FE58DE4C810'],
        extra: {
          arn: 'arn:aws:s3:::mybucket',
        },
      },
    ]);
    expect(getTestableTrigger(exampleApiGatewayEvent)).toEqual([
      {
        triggeredBy: EventTrigger.ApiGateway,
        fromMessageIds: ['deef4878-7910-11e6-8f14-25afc3e9ae33'],
        extra: {
          api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
          httpMethod: 'POST',
          resource: '/{proxy+}',
          stage: 'testStage',
        },
      },
    ]);
    expect(getTestableTrigger(exampleEventBridgeEvent)).toEqual([
      {
        triggeredBy: EventTrigger.EventBridge,
        fromMessageIds: ['f0f73aaa-e64f-a550-5be2-850898090583'],
      },
    ]);

    expect(getTestableTrigger(exampleSesEvent)).toEqual([]);
    expect(getTestableTrigger(exampleAppSyncEvent)).toEqual([
      {
        triggeredBy: EventTrigger.AppSync,
        fromMessageIds: ['1-5fa161de-275509e254bf71cc48gc66d0'],
        extra: {
          api: 'oookuwqyrfhy7eexeksfovlbem.appsync-api.eu-west-1.amazonaws.com',
        },
      },
    ]);
    expect(getTestableTrigger(exampleAppSyncSecondEvent)).toEqual([
      {
        triggeredBy: EventTrigger.AppSync,
        fromMessageIds: ['1-5fa98965-523cdde90f6d0a5343bd9b4f'],
        extra: {
          api: 'e6lstibe25cgfnropjv2gjuuc4.appsync-api.us-west-2.amazonaws.com',
        },
      },
    ]);
    expect(getTestableTrigger(exampleUnsupportedEvent)).toEqual([]);
    expect(getTestableTrigger(exampleEventBridgeSqsEvent)).toEqual([
      {
        extra: {
          arn: 'arn:aws:sqs:us-west-2:123456789:test-queue',
        },
        fromMessageIds: ['sqsMessage-aaaaa-bbbb-cccc-ddddddddd'],
        triggeredBy: 'sqs',
      },
      {
        fromMessageIds: ['eventBusMessage-bbbbb-ccccc-ddddddddd'],
        triggeredBy: 'eventBridge',
      },
    ]);
  });

  test('trigger recursive links', () => {
    const actualTriggers = events.getEventInfo(exampleTwoSnsSqsEvent);
    expect(actualTriggers.trigger.length).toBe(3);
    const sqsTrigger = actualTriggers.trigger.find((t) => t.triggeredBy === EventTrigger.SQS);
    const snsTriggers = actualTriggers.trigger.filter((t) => t.triggeredBy === EventTrigger.SNS);
    snsTriggers.forEach((sns) => expect(sqsTrigger.id).toEqual(sns.targetId));
    expect(sqsTrigger.fromMessageIds).toEqual(['sqs-1', 'sqs-2']);
    expect(snsTriggers.map((sns) => sns.fromMessageIds).flat()).toEqual(['sns-1', 'sns-2']);
  });

  test('test INNER_MESSAGES_MAGIC_PATTERN', () => {
    const innerSns =
      '{\n  "Type" : "Notification",\n  "MessageId" : "aaaaa-bbbbb-ccccc-ddddddddd",\n  "TopicArn" : "arn:aws:sns:us-west-2:1234567891011:test-queue",\n  "Message" : "{}",\n  "Timestamp" : "2022-06-29T19:22:59.929Z",\n  "SignatureVersion" : "1",\n  "Signature" : "BLABLA",\n  "SigningCertURL" : "https://sns.us-west-2.amazonaws.com/SimpleNotificationService-blablabla.pem",\n  "UnsubscribeURL" : "https://sns.us-west-2.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-west-2:123456789:test-queue:blablabla"\n}';
    expect(innerSns.search(INNER_MESSAGES_MAGIC_PATTERN)).not.toEqual(-1);

    const innerEventBridge =
      '{"version":"0","id":"eventBusMessage-bbbbb-ccccc-ddddddddd","detail-type":"string","source":"IT","region":"us-west-2","resources":[],"detail":{}}';
    expect(innerEventBridge.search(INNER_MESSAGES_MAGIC_PATTERN)).not.toEqual(-1);

    const otherMessage = 'otherMessage';
    expect(otherMessage.search(INNER_MESSAGES_MAGIC_PATTERN)).toEqual(-1);
  });

  test('test recursive triggers too deep', () => {
    const basicSqs = {
      Records: [
        {
          body: 'Message Body',
          eventSource: 'aws:sqs',
          messageAttributes: 'detail-type', // To trigger the recursive parsing
        },
      ],
    };
    let currentSqs = basicSqs;
    for (let i = 0; i < getChainedServicesMaxDepth() + 10; i++) {
      const previous = currentSqs;
      currentSqs = basicSqs;
      currentSqs.Records[0].body = JSON.stringify(previous);
    }

    const actualTriggers = events.getEventInfo(currentSqs);
    expect(actualTriggers.trigger.length).toEqual(getChainedServicesMaxDepth() + 1);
  });

  test('test recursive triggers too wide', () => {
    const sqs = {
      Records: Array(getChainedServicesMaxWidth() + 10).fill({
        body: JSON.stringify({
          Records: [
            { body: 'Message Body', eventSource: 'aws:sqs', messageAttributes: 'detail-type' },
          ],
        }),
        eventSource: 'aws:sqs',
        messageAttributes: 'detail-type', // To trigger the recursive parsing
      }),
    };

    const actualTriggers = events.getEventInfo(sqs);
    expect(actualTriggers.trigger.length).toEqual(getChainedServicesMaxWidth() + 1);
  });

  test('test exception in shouldHandle', () => {
    class TestEventParser extends EventTriggerParser {
      _shouldHandle = (event: IncomingEvent): boolean => {
        throw Error('Boom');
      };

      handle = (event: IncomingEvent, targetId: string | null): Trigger => {
        return {
          id: getRandomId(),
          targetId: targetId,
          triggeredBy: EventTrigger.AppSync,
          fromMessageIds: [],
        };
      };
    }

    expect(new TestEventParser().shouldHandle({})).toBeFalsy();
  });

  test('getEventInfo', () => {
    expect(getTestableTrigger(exampleApiGatewayEvent)).toEqual([
      {
        triggeredBy: EventTrigger.ApiGateway,
        fromMessageIds: ['deef4878-7910-11e6-8f14-25afc3e9ae33'],
        extra: {
          api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
          httpMethod: 'POST',
          resource: '/{proxy+}',
          stage: 'testStage',
        },
      },
    ]);

    expect(getTestableTrigger(exampleS3Event)).toEqual([
      {
        triggeredBy: EventTrigger.S3,
        fromMessageIds: ['C3D13FE58DE4C810'],
        extra: {
          arn: 'arn:aws:s3:::mybucket',
        },
      },
    ]);

    TracerGlobals.setTracerInputs({ stepFunction: true });
    expect(
      getTestableTrigger({
        data: 1,
        [utils.LUMIGO_EVENT_KEY]: { [utils.STEP_FUNCTION_UID_KEY]: '123' },
      })
    ).toEqual([
      {
        triggeredBy: EventTrigger.StepFunction,
        fromMessageIds: ['123'],
      },
    ]);
  });
});
