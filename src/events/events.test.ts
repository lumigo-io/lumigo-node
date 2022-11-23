import * as exampleS3Event from '../../testUtils/testdata/events/s3-event.json';
import * as exampleSnsEvent from '../../testUtils/testdata/events/sns-event.json';
import * as exampleSesEvent from '../../testUtils/testdata/events/ses-event.json';
import * as exampleSqsEvent from '../../testUtils/testdata/events/sqs-event.json';
import * as exampleSnsSqsEvent from '../../testUtils/testdata/events/sns-sqs-event.json';
import * as exampleSqsNonSnsEvent from '../../testUtils/testdata/events/sqs-non-sns-event.json';
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
import { md5Hash } from '../utils';
import { TracerGlobals } from '../globals';
import * as events from './events';
import { EventTrigger } from './event-trigger.enum';

describe('events', () => {
  test('getTriggeredBy', () => {
    expect(events.getTriggeredBy(exampleS3Event)).toEqual(EventTrigger.S3);
    expect(events.getTriggeredBy(exampleSnsEvent)).toEqual(EventTrigger.SNS);
    expect(events.getTriggeredBy(exampleSesEvent)).toEqual(EventTrigger.SES);
    expect(events.getTriggeredBy(exampleKinesisEvent)).toEqual(EventTrigger.Kinesis);
    expect(events.getTriggeredBy(exampleApiGatewayEvent)).toEqual(EventTrigger.ApiGateway);
    expect(events.getTriggeredBy(exampleFalseApiGatewayEvent)).toEqual('invocation');
    expect(events.getTriggeredBy(exampleDynamoDBInsertEvent)).toEqual(EventTrigger.DynamoDB);
    expect(events.getTriggeredBy(exampleEventBridgeEvent)).toEqual(EventTrigger.EventBridge);
    expect(events.getTriggeredBy(exampleAppSyncEvent)).toEqual(EventTrigger.AppSync);
    expect(events.getTriggeredBy(exampleAppSyncSecondEvent)).toEqual(EventTrigger.AppSync);
    expect(events.getTriggeredBy(exampleUnsupportedEvent)).toEqual('invocation');
    expect(events.getTriggeredBy(exampleEmptySqsEvent)).toEqual('invocation');
  });

  test('getApiGatewayData', () => {
    // @ts-ignore TODO: fix the example file to fit the API Gateway event type definition
    expect(events.getApiGatewayData(exampleApiGatewayEvent)).toEqual({
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      resource: '/{proxy+}',
      stage: 'testStage',
    });

    // @ts-ignore TODO: fix the example file to fit the API Gateway event type definition
    expect(events.getApiGatewayData(exampleApiGatewayEventWithoutHost)).toEqual({
      api: null,
      httpMethod: undefined,
      resource: undefined,
      stage: '$default',
    });
  });

  test('getApiGatewayData => API gw v2', () => {
    // @ts-ignore TODO: fix the example file to fit the API Gateway v2 event type definition
    expect(events.getApiGatewayData(exampleApiGatewayV2Event)).toEqual({
      api: 'r3pmxmplak.execute-api.us-east-2.amazonaws.com',
      httpMethod: 'GET',
      messageId: 'JKJaXmPLvHcESHA=',
      resource: '/default/nodejs-apig-function-1G3XMPLZXVXYI',
      stage: 'default',
    });
  });

  test('getSnsData', () => {
    expect(events.getSnsData(exampleSnsEvent)).toEqual({
      arn: 'arn:aws:sns:EXAMPLE',
      messageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
    });
  });

  test('getRelevantEventData', () => {
    expect(events.getRelevantEventData(EventTrigger.SQS, exampleSqsEvent)).toEqual({
      arn: 'arn:aws:sqs:us-west-2:123456789012:SQSQueue',
      messageId: 'MessageID_1',
    });

    expect(events.getRelevantEventData(EventTrigger.SQS, exampleSqsManyMessagesEvent)).toEqual({
      arn: 'arn:aws:sqs:us-west-2:123456789012:SQSQueue',
      messageIds: ['MessageID_1', 'MessageID_2'],
    });

    expect(events.getRelevantEventData(EventTrigger.SQS, exampleSnsSqsEvent)).toEqual({
      arn: 'arn:aws:sqs:us-east-1:123456789:sqs-queue-name',
      messageIdToChainResource: [
        {
          TopicArn: 'arn:aws:sns:us-west-2:723663554526:tracer-test-saart-temp-Pttcj',
          childMessageId: 'f4ceb23d-2ae7-44d3-b171-df7ab2d10a81',
          parentMessageId: '2c78f253-4cd9-57bb-8bc3-a965e40a293e',
          resourceType: 'sns',
        },
      ],
      messageIds: ['f4ceb23d-2ae7-44d3-b171-df7ab2d10a81', '2c78f253-4cd9-57bb-8bc3-a965e40a293e'],
    });

    expect(events.getRelevantEventData(EventTrigger.SQS, exampleSqsNonSnsEvent)).toEqual({
      arn: 'arn:aws:sqs:us-east-1:123456789:sqs-queue-name',
      messageId: 'f4ceb23d-2ae7-44d3-b171-df7ab2d10a81',
    });

    expect(events.getRelevantEventData(EventTrigger.Kinesis, exampleKinesisEvent)).toEqual({
      arn: 'arn:aws:kinesis:us-east-1:123456789012:stream/simple-stream',
      messageIds: [
        '49568167373333333333333333333333333333333333333333333333',
        '49568167373333333334444444444444444444444444444444444444',
      ],
    });

    expect(events.getRelevantEventData(EventTrigger.DynamoDB, exampleDynamoDBInsertEvent)).toEqual({
      arn: 'arn:aws:dynamodb:us-east-1:123456789012:table/Example-Table/stream/2016-12-01T00:00:00.000',
      messageIds: [
        md5Hash({
          val: { S: 'data' },
          asdf1: { B: 'AAEqQQ==' },
          asdf2: { BS: ['AAEqQQ==', 'QSoBAA=='] },
          key: { S: 'binary' },
        }),
        'fa2800aae04015828d3b0acef25db799',
      ],
      approxEventCreationTime: 1480642020000,
    });

    expect(events.getRelevantEventData(EventTrigger.DynamoDB, exampleDynamoDBModifyEvent)).toEqual({
      arn: 'arn:aws:dynamodb:us-west-2:723663554526:table/abbbbb/stream/2020-05-25T12:04:49.788',
      messageIds: [md5Hash({ key: { N: '8' } })],
      approxEventCreationTime: 1590509701000,
    });

    expect(events.getRelevantEventData(EventTrigger.DynamoDB, exampleDynamoDBRemoveEvent)).toEqual({
      arn: 'arn:aws:dynamodb:us-west-2:723663554526:table/abbbbb/stream/2020-05-25T12:04:49.788',
      messageIds: [md5Hash({ key: { N: '123' } })],
      approxEventCreationTime: 1590509672000,
    });

    expect(events.getRelevantEventData(EventTrigger.SNS, exampleSnsEvent)).toEqual({
      arn: 'arn:aws:sns:EXAMPLE',
      messageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
    });

    expect(events.getRelevantEventData(EventTrigger.S3, exampleS3Event)).toEqual({
      arn: 'arn:aws:s3:::mybucket',
      messageId: 'C3D13FE58DE4C810',
    });
    expect(events.getRelevantEventData(EventTrigger.ApiGateway, exampleApiGatewayEvent)).toEqual({
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      resource: '/{proxy+}',
      stage: 'testStage',
    });
    expect(events.getRelevantEventData(EventTrigger.EventBridge, exampleEventBridgeEvent)).toEqual({
      messageId: 'f0f73aaa-e64f-a550-5be2-850898090583',
    });

    expect(events.getRelevantEventData(EventTrigger.SES, exampleSesEvent)).toEqual({});
    expect(events.getRelevantEventData(EventTrigger.AppSync, exampleAppSyncEvent)).toEqual({
      api: 'oookuwqyrfhy7eexeksfovlbem.appsync-api.eu-west-1.amazonaws.com',
      messageId: '1-5fa161de-275509e254bf71cc48gc66d0',
    });
    expect(events.getRelevantEventData(EventTrigger.AppSync, exampleAppSyncSecondEvent)).toEqual({
      api: 'e6lstibe25cgfnropjv2gjuuc4.appsync-api.us-west-2.amazonaws.com',
      messageId: '1-5fa98965-523cdde90f6d0a5343bd9b4f',
    });
    expect(events.getRelevantEventData(EventTrigger.Invocation, exampleUnsupportedEvent)).toEqual(
      {}
    );
  });

  test('getEventInfo', () => {
    expect(events.getEventInfo(exampleApiGatewayEvent)).toEqual({
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      resource: '/{proxy+}',
      stage: 'testStage',
      triggeredBy: EventTrigger.ApiGateway,
    });

    expect(events.getEventInfo(exampleS3Event)).toEqual({
      arn: 'arn:aws:s3:::mybucket',
      messageId: 'C3D13FE58DE4C810',
      triggeredBy: EventTrigger.S3,
    });

    TracerGlobals.setTracerInputs({ stepFunction: true });
    expect(
      events.getEventInfo({
        data: 1,
        [utils.LUMIGO_EVENT_KEY]: { [utils.STEP_FUNCTION_UID_KEY]: '123' },
      })
    ).toEqual({
      triggeredBy: EventTrigger.StepFunction,
      messageId: '123',
    });
  });
});
