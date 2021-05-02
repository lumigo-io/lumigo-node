import * as utils from './utils';
import { TracerGlobals } from './globals';
import { md5Hash } from './utils';

const events = require('./events');
const exampleS3Event = require('../testUtils/testdata/events/s3-event.json');
const exampleSnsEvent = require('../testUtils/testdata/events/sns-event.json');
const exampleSesEvent = require('../testUtils/testdata/events/ses-event.json');
const exampleSqsEvent = require('../testUtils/testdata/events/sqs-event.json');
const exampleSqsManyMessagesEvent = require('../testUtils/testdata/events/sqs-event-many-messages.json');
const exampleKinesisEvent = require('../testUtils/testdata/events/kinesis-event.json');
const exampleDynamoDBInsertEvent = require('../testUtils/testdata/events/dynamodb-insert-event.json');
const exampleDynamoDBModifyEvent = require('../testUtils/testdata/events/dynamodb-modify-event.json');
const exampleDynamoDBRemoveEvent = require('../testUtils/testdata/events/dynamodb-remove-event.json');
const exampleApiGatewayEvent = require('../testUtils/testdata/events/apigw-request.json');
const exampleFalseApiGatewayEvent = require('./testdata/events/false-apigw-request.json');
const exampleApiGatewayV2Event = require('../testUtils/testdata/events/apigw-v2-event.json');
const exampleUnsupportedEvent = require('../testUtils/testdata/events/appsync-invoke.json');
const exampleApiGatewayEventWithoutHost = require('../testUtils/testdata/events/apigw-custom-auth-request.json');
const exampleEventBridgeEvent = require('../testUtils/testdata/events/event-bridge-event.json');
const exampleAppSyncEvent = require('../testUtils/testdata/events/appsync-event.json');
const exampleAppSyncSecondEvent = require('../testUtils/testdata/events/appsync-second-event.json');

describe('events', () => {
  test('getTriggeredBy', () => {
    expect(events.getTriggeredBy(exampleS3Event)).toEqual('s3');
    expect(events.getTriggeredBy(exampleSnsEvent)).toEqual('sns');
    expect(events.getTriggeredBy(exampleSesEvent)).toEqual('ses');
    expect(events.getTriggeredBy(exampleKinesisEvent)).toEqual('kinesis');
    expect(events.getTriggeredBy(exampleApiGatewayEvent)).toEqual('apigw');
    expect(events.getTriggeredBy(exampleFalseApiGatewayEvent)).toEqual('invocation');
    expect(events.getTriggeredBy(exampleDynamoDBInsertEvent)).toEqual('dynamodb');
    expect(events.getTriggeredBy(exampleEventBridgeEvent)).toEqual('eventBridge');
    expect(events.getTriggeredBy(exampleAppSyncEvent)).toEqual('appsync');
    expect(events.getTriggeredBy(exampleAppSyncSecondEvent)).toEqual('appsync');
    expect(events.getTriggeredBy(exampleUnsupportedEvent)).toEqual('invocation');
  });

  test('getApiGatewayData', () => {
    expect(events.getApiGatewayData(exampleApiGatewayEvent)).toEqual({
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      resource: '/{proxy+}',
      stage: 'testStage',
    });

    expect(events.getApiGatewayData(exampleApiGatewayEventWithoutHost)).toEqual({
      api: null,
      httpMethod: undefined,
      resource: undefined,
      stage: null,
    });
  });

  test('getApiGatewayData => API gw v2', () => {
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
    expect(events.getRelevantEventData('sqs', exampleSqsEvent)).toEqual({
      arn: 'arn:aws:sqs:us-west-2:123456789012:SQSQueue',
      messageId: 'MessageID_1',
    });

    expect(events.getRelevantEventData('sqs', exampleSqsManyMessagesEvent)).toEqual({
      arn: 'arn:aws:sqs:us-west-2:123456789012:SQSQueue',
      messageIds: ['MessageID_1', 'MessageID_2'],
    });

    expect(events.getRelevantEventData('kinesis', exampleKinesisEvent)).toEqual({
      arn: 'arn:aws:kinesis:us-east-1:123456789012:stream/simple-stream',
      messageIds: [
        '49568167373333333333333333333333333333333333333333333333',
        '49568167373333333334444444444444444444444444444444444444',
      ],
    });

    expect(events.getRelevantEventData('dynamodb', exampleDynamoDBInsertEvent)).toEqual({
      arn:
        'arn:aws:dynamodb:us-east-1:123456789012:table/Example-Table/stream/2016-12-01T00:00:00.000',
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

    expect(events.getRelevantEventData('dynamodb', exampleDynamoDBModifyEvent)).toEqual({
      arn: 'arn:aws:dynamodb:us-west-2:723663554526:table/abbbbb/stream/2020-05-25T12:04:49.788',
      messageIds: [md5Hash({ key: { N: '8' } })],
      approxEventCreationTime: 1590509701000,
    });

    expect(events.getRelevantEventData('dynamodb', exampleDynamoDBRemoveEvent)).toEqual({
      arn: 'arn:aws:dynamodb:us-west-2:723663554526:table/abbbbb/stream/2020-05-25T12:04:49.788',
      messageIds: [md5Hash({ key: { N: '123' } })],
      approxEventCreationTime: 1590509672000,
    });

    expect(events.getRelevantEventData('sns', exampleSnsEvent)).toEqual({
      arn: 'arn:aws:sns:EXAMPLE',
      messageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
    });

    expect(events.getRelevantEventData('s3', exampleS3Event)).toEqual({
      arn: 'arn:aws:s3:::mybucket',
    });
    expect(events.getRelevantEventData('apigw', exampleApiGatewayEvent)).toEqual({
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      resource: '/{proxy+}',
      stage: 'testStage',
    });
    expect(events.getRelevantEventData('eventBridge', exampleEventBridgeEvent)).toEqual({
      messageId: 'f0f73aaa-e64f-a550-5be2-850898090583',
    });

    expect(events.getRelevantEventData('ses', exampleSesEvent)).toEqual({});
    expect(events.getRelevantEventData('appsync', exampleAppSyncEvent)).toEqual({
      api: 'oookuwqyrfhy7eexeksfovlbem.appsync-api.eu-west-1.amazonaws.com',
      messageId: '1-5fa161de-275509e254bf71cc48gc66d0',
    });
    expect(events.getRelevantEventData('appsync', exampleAppSyncSecondEvent)).toEqual({
      api: 'e6lstibe25cgfnropjv2gjuuc4.appsync-api.us-west-2.amazonaws.com',
      messageId: '1-5fa98965-523cdde90f6d0a5343bd9b4f',
    });
    expect(events.getRelevantEventData('invocation', exampleUnsupportedEvent)).toEqual({});
  });

  test('getEventInfo', () => {
    expect(events.getEventInfo(exampleApiGatewayEvent)).toEqual({
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      resource: '/{proxy+}',
      stage: 'testStage',
      triggeredBy: 'apigw',
    });

    expect(events.getEventInfo(exampleS3Event)).toEqual({
      arn: 'arn:aws:s3:::mybucket',
      triggeredBy: 's3',
    });

    TracerGlobals.setTracerInputs({ stepFunction: true });
    expect(
      events.getEventInfo({
        data: 1,
        [utils.LUMIGO_EVENT_KEY]: { [utils.STEP_FUNCTION_UID_KEY]: '123' },
      })
    ).toEqual({
      triggeredBy: 'stepFunction',
      messageId: '123',
    });
  });
});
