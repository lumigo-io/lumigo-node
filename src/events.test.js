import * as utils from './utils';
import { TracerGlobals } from './globals';

const events = require('./events');
const exampleS3Event = require('./testdata/events/s3-event.json');
const exampleSnsEvent = require('./testdata/events/sns-event.json');
const exampleSesEvent = require('./testdata/events/ses-event.json');
const exampleSqsEvent = require('./testdata/events/sqs-event.json');
const exampleKinesisEvent = require('./testdata/events/kinesis-event.json');
const exampleDynamoDBEvent = require('./testdata/events/dynamodb-event.json');
const exampleApiGatewayEvent = require('./testdata/events/apigw-request.json');
const exampleApiGatewayV2Event = require('./testdata/events/apigw-v2-event.json');
const exampleUnsupportedEvent = require('./testdata/events/appsync-invoke.json');
const exampleApiGatewayEventWithoutHost = require('./testdata/events/apigw-custom-auth-request.json');

describe('events', () => {
  test('getTriggeredBy', () => {
    expect(events.getTriggeredBy(exampleS3Event)).toEqual('s3');
    expect(events.getTriggeredBy(exampleSnsEvent)).toEqual('sns');
    expect(events.getTriggeredBy(exampleSesEvent)).toEqual('ses');
    expect(events.getTriggeredBy(exampleKinesisEvent)).toEqual('kinesis');
    expect(events.getTriggeredBy(exampleApiGatewayEvent)).toEqual('apigw');
    expect(events.getTriggeredBy(exampleDynamoDBEvent)).toEqual('dynamodb');
    expect(events.getTriggeredBy(exampleUnsupportedEvent)).toEqual(
      'invocation'
    );
  });

  test('getApiGatewayData', () => {
    expect(events.getApiGatewayData(exampleApiGatewayEvent)).toEqual({
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      resource: '/{proxy+}',
      stage: 'testStage',
    });

    expect(events.getApiGatewayData(exampleApiGatewayEventWithoutHost)).toEqual(
      {
        api: null,
        httpMethod: undefined,
        resource: undefined,
        stage: null,
      }
    );
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
      messageIds: ['MessageID_1', 'MessageID_2'],
    });

    expect(events.getRelevantEventData('kinesis', exampleKinesisEvent)).toEqual(
      {
        arn: 'arn:aws:kinesis:us-east-1:123456789012:stream/simple-stream',
        messageIds: [
          '49568167373333333333333333333333333333333333333333333333',
          '49568167373333333334444444444444444444444444444444444444',
        ],
      }
    );
    expect(
      events.getRelevantEventData('dynamodb', exampleDynamoDBEvent)
    ).toEqual({
      arn:
        'arn:aws:dynamodb:us-east-1:123456789012:table/Example-Table/stream/2016-12-01T00:00:00.000',
    });

    expect(events.getRelevantEventData('sns', exampleSnsEvent)).toEqual({
      arn: 'arn:aws:sns:EXAMPLE',
      messageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
    });

    expect(events.getRelevantEventData('s3', exampleS3Event)).toEqual({
      arn: 'arn:aws:s3:::mybucket',
    });
    expect(
      events.getRelevantEventData('apigw', exampleApiGatewayEvent)
    ).toEqual({
      api: 'gy415nuibc.execute-api.us-east-1.amazonaws.com',
      httpMethod: 'POST',
      messageId: 'deef4878-7910-11e6-8f14-25afc3e9ae33',
      resource: '/{proxy+}',
      stage: 'testStage',
    });

    expect(events.getRelevantEventData('ses', exampleSesEvent)).toEqual({});
    expect(
      events.getRelevantEventData('invocation', exampleUnsupportedEvent)
    ).toEqual({});
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
