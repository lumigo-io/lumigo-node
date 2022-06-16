import * as EventParser from './eventParser';
import * as EventChecker from './eventChecker';

describe('event parser', () => {
  const S3_EVENT = {
    Records: [
      {
        eventSource: 'aws:s3',
        awsRegion: 'us-west-2',
        eventTime: '2020-12-23T08:22:34.629Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: { principalId: 'AMLG687EH3ZOI' },
        requestParameters: { sourceIPAddress: '185.3.145.127' },
        s3: {
          bucket: { arn: 'arn:aws:s3:::tracer-test-nirhod-s3-bucket' },
          object: { key: 'value', size: 2148 },
        },
      },
    ],
  };

  test('check null value', () => {
    expect(EventParser.parseEvent(null)).toEqual(null);
  });

  test('null check', () => {
    expect(EventParser.parseEvent(null)).toEqual(null);
  });

  test('exception check', () => {
    const event = {
      get requestContext() {
        throw new Error();
      },
      a: 1,
    };
    expect(EventParser.parseEvent(event)).toEqual(event);
  });

  test('EventParser.getSkipScrubPath S3', () => {
    expect(EventParser.getSkipScrubPath(S3_EVENT)).toEqual(['Records', [], 's3', 'object', 'key']);
  });

  test('EventParser.getSkipScrubPath DDB', () => {
    const ddbEvent = {
      Records: [
        {
          eventID: '22222222222222222222222222222222',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-west-2',
          dynamodb: {
            ApproximateCreationDateTime: 1613303796,
            Keys: { k: { S: 'k1' } },
            NewImage: { v: { S: 'v1' }, k: { S: 'k1' } },
            SequenceNumber: '111111111111111111111111111',
            SizeBytes: 9,
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
          eventSourceARN:
            'arn:aws:dynamodb:us-west-2:111111111111:table/table-with-stream/stream/2020-08-25T09:03:34.483',
        },
      ],
    };
    expect(EventParser.getSkipScrubPath(ddbEvent)).toEqual(['Records', [], 'dynamodb', 'Keys']);
  });

  test('EventParser.getSkipScrubPath service without skipping', () => {
    expect(EventParser.getSkipScrubPath({})).toEqual(null);
  });

  test('EventParser.getSkipScrubPath - skipping disabled by env var', () => {
    process.env.LUMIGO_SCRUB_KNOWN_SERVICES = 'true';
    expect(EventParser.getSkipScrubPath(S3_EVENT)).toEqual(null);
  });

  test('api gw v1', () => {
    const notOrderApiGwEvent = {
      resource: '/add-user',
      path: '/add-user',
      httpMethod: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        Authorization: 'auth',
        'CloudFront-Forwarded-Proto': 'https',
        'CloudFront-Is-Desktop-Viewer': 'true',
        'CloudFront-Is-Mobile-Viewer': 'false',
        'CloudFront-Is-SmartTV-Viewer': 'false',
        'CloudFront-Is-Tablet-Viewer': 'false',
        'CloudFront-Viewer-Country': 'IL',
        'content-type': 'application/json;charset=UTF-8',
        // eslint-disable-next-line camelcase
        customer_id: 'c_1111',
        Host: 'aaaa.execute-api.us-west-2.amazonaws.com',
        origin: 'https://aaa.io',
        Referer: 'https://aaa.io/users',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36',
        Via: '2.0 59574f77a7cf2d23d64904db278e5711.cloudfront.net (CloudFront)',
        'X-Amz-Cf-Id': 'J4KbOEUrZCnUQSLsDq1PyYXmfpVy8x634huSeBX0HCbscgH-N2AtVA==',
        'X-Amzn-Trace-Id': 'Root=1-5e9bf868-1c53a38cfe070266db0bfbd9',
        'X-Forwarded-For': '5.102.206.161, 54.182.243.106',
        'X-Forwarded-Port': '443',
        'X-Forwarded-Proto': 'https',
      },
      multiValueHeaders: {
        Accept: ['application/json, text/plain, */*'],
        'Accept-Encoding': ['gzip, deflate, br'],
        'Accept-Language': ['he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'],
        Authorization: ['auth'],
        'CloudFront-Forwarded-Proto': ['https'],
        'CloudFront-Is-Desktop-Viewer': ['true'],
        'CloudFront-Is-Mobile-Viewer': ['false'],
        'CloudFront-Is-SmartTV-Viewer': ['false'],
        'CloudFront-Is-Tablet-Viewer': ['false'],
        'CloudFront-Viewer-Country': ['IL'],
        'content-type': ['application/json;charset=UTF-8'],
        // eslint-disable-next-line camelcase
        customer_id: ['c_1111'],
        Host: ['a.execute-api.us-west-2.amazonaws.com'],
        origin: ['https://aaa.io'],
        Referer: ['https://aaa.io/users'],
        'sec-fetch-dest': ['empty'],
        'sec-fetch-mode': ['cors'],
        'sec-fetch-site': ['cross-site'],
        'User-Agent': [
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36',
        ],
        Via: ['2.0 59574f77a7cf2d23d64904db278e5711.cloudfront.net (CloudFront)'],
        'X-Amz-Cf-Id': ['J4KbOEUrZCnUQSLsDq1PyYXmfpVy8x634huSeBX0HCbscgH-N2AtVA=='],
        'X-Amzn-Trace-Id': ['Root=1-5e9bf868-1c53a38cfe070266db0bfbd9'],
        'X-Forwarded-For': ['5.102.206.161, 54.182.243.106'],
        'X-Forwarded-Port': ['443'],
        'X-Forwarded-Proto': ['https'],
      },
      queryStringParameters: '1',
      multiValueQueryStringParameters: '1',
      pathParameters: '1',
      stageVariables: null,
      requestContext: {
        resourceId: 'ua33sn',
        authorizer: {
          claims: {
            sub: 'a87005bb-3030-4962-bae8-48cd629ba20b',
            'custom:customer': 'c_1111',
            iss: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2',
            'custom:customer-name': 'a',
            'cognito:username': 'aa',
            aud: '4lidcnek50hi18996gadaop8j0',
            // eslint-disable-next-line camelcase
            event_id: '9fe80735-f265-41d5-a7ca-04b88c2a4a4c',
            // eslint-disable-next-line camelcase
            token_use: 'id',
            // eslint-disable-next-line camelcase
            auth_time: '1587038744',
            exp: 'Sun Apr 19 08:06:14 UTC 2020',
            'custom:role': 'admin',
            iat: 'Sun Apr 19 07:06:14 UTC 2020',
            email: 'a@a.com',
          },
        },
        resourcePath: '/add-user',
        httpMethod: 'POST',
        extendedRequestId: 'LOPAXFcuvHcFUKg=',
        requestTime: '19/Apr/2020:07:06:16 +0000',
        path: '/prod/add-user',
        accountId: '114300393969',
        protocol: 'HTTP/1.1',
        stage: 'prod',
        domainPrefix: 'psqn7b0ev2',
        requestTimeEpoch: 1587279976628,
        requestId: '78542821-ca17-4e83-94ec-96993a9d451d',
        identity: {
          cognitoIdentityPoolId: null,
          accountId: null,
          cognitoIdentityId: null,
          caller: null,
          sourceIp: '5.102.206.161',
          principalOrgId: null,
          accessKey: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36',
          user: null,
        },
        domainName: 'psqn7b0ev2.execute-api.us-west-2.amazonaws.com',
        apiId: 'psqn7b0ev2',
      },
      body: '{"email":"a@a.com"}',
      isBase64Encoded: false,
    };

    const orderApiGwEvent = EventParser.parseEvent(notOrderApiGwEvent);

    expect(JSON.stringify(orderApiGwEvent)).toEqual(
      JSON.stringify({
        resource: '/add-user',
        path: '/add-user',
        httpMethod: 'POST',
        queryStringParameters: '1',
        pathParameters: '1',
        body: '{"email":"a@a.com"}',
        requestContext: {
          authorizer: {
            claims: {
              sub: 'a87005bb-3030-4962-bae8-48cd629ba20b',
              'custom:customer': 'c_1111',
              iss: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2',
              'custom:customer-name': 'a',
              'cognito:username': 'aa',
              aud: '4lidcnek50hi18996gadaop8j0',
              // eslint-disable-next-line camelcase
              event_id: '9fe80735-f265-41d5-a7ca-04b88c2a4a4c',
              // eslint-disable-next-line camelcase
              token_use: 'id',
              // eslint-disable-next-line camelcase
              auth_time: '1587038744',
              exp: 'Sun Apr 19 08:06:14 UTC 2020',
              'custom:role': 'admin',
              iat: 'Sun Apr 19 07:06:14 UTC 2020',
              email: 'a@a.com',
            },
          },
          requestId: '78542821-ca17-4e83-94ec-96993a9d451d',
        },
        headers: {
          Authorization: 'auth',
          'content-type': 'application/json;charset=UTF-8',
          // eslint-disable-next-line camelcase
          customer_id: 'c_1111',
          Host: 'aaaa.execute-api.us-west-2.amazonaws.com',
          origin: 'https://aaa.io',
          Referer: 'https://aaa.io/users',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36',
        },
        stageVariables: null,
        isBase64Encoded: false,
      })
    );
  });

  test('api gw v2', () => {
    const notOrderApiGwEvent = {
      version: '2.0',
      routeKey: 'ANY /nodejs-apig-function-1G3XMPLZXVXYI',
      rawPath: '/default/nodejs-apig-function-1G3XMPLZXVXYI',
      rawQueryString: '',
      cookies: ['s_fid=7AABXMPL1AFD9BBF-0643XMPL09956DE2', 'regStatus=pre-register'],
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'content-length': '0',
        host: 'r3pmxmplak.execute-api.us-east-2.amazonaws.com',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
        'x-amzn-trace-id': 'Root=1-5e6722a7-cc56xmpl46db7ae02d4da47e',
        'x-forwarded-for': '205.255.255.176',
        'x-forwarded-port': '443',
        'x-forwarded-proto': 'https',
      },
      requestContext: {
        accountId: '123456789012',
        apiId: 'r3pmxmplak',
        domainName: 'r3pmxmplak.execute-api.us-east-2.amazonaws.com',
        domainPrefix: 'r3pmxmplak',
        http: {
          method: 'GET',
          path: '/default/nodejs-apig-function-1G3XMPLZXVXYI',
          protocol: 'HTTP/1.1',
          sourceIp: '205.255.255.176',
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
        },
        requestId: 'JKJaXmPLvHcESHA=',
        routeKey: 'ANY /nodejs-apig-function-1G3XMPLZXVXYI',
        stage: 'default',
        time: '10/Mar/2020:05:16:23 +0000',
        timeEpoch: 1583817383220,
      },
      isBase64Encoded: true,
    };

    const orderApiGwEvent = EventParser.parseEvent(notOrderApiGwEvent);

    expect(JSON.stringify(orderApiGwEvent)).toEqual(
      JSON.stringify({
        version: '2.0',
        routeKey: 'ANY /nodejs-apig-function-1G3XMPLZXVXYI',
        rawPath: '/default/nodejs-apig-function-1G3XMPLZXVXYI',
        rawQueryString: '',
        requestContext: {
          http: {
            method: 'GET',
            path: '/default/nodejs-apig-function-1G3XMPLZXVXYI',
            protocol: 'HTTP/1.1',
            sourceIp: '205.255.255.176',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
          },
          requestId: 'JKJaXmPLvHcESHA=',
        },
        headers: {
          'content-length': '0',
          host: 'r3pmxmplak.execute-api.us-east-2.amazonaws.com',
          'upgrade-insecure-requests': '1',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
        },
        cookies: ['s_fid=7AABXMPL1AFD9BBF-0643XMPL09956DE2', 'regStatus=pre-register'],
        isBase64Encoded: true,
      })
    );
  });

  test('sns parse', () => {
    const notOrderSnsEvent = {
      Records: [
        {
          EventVersion: '1.0',
          EventSubscriptionArn:
            'arn:aws:sns:us-east-2:123456789012:sns-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
          EventSource: 'aws:sns',
          Sns: {
            SignatureVersion: '1',
            Timestamp: '2019-01-02T12:45:07.000Z',
            Signature: 'tcc6faL2yUC6dgZdmrwh1Y4cGa/ebXEkAi6RibDsvpi+tE/1+82j...65r==',
            SigningCertUrl:
              'https://sns.us-east-2.amazonaws.com/SimpleNotificationService-ac565b8b1a6c5d002d285f9598aa1d9b.pem',
            MessageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
            Message: 'Hello from SNS1!',
            MessageAttributes: {
              Test: { Type: 'String', Value: 'TestString' },
              TestBinary: { Type: 'Binary', Value: 'TestBinary' },
            },
            Type: 'Notification',
            UnsubscribeUrl:
              'https://sns.us-east-2.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-east-2:123456789012:test-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
            TopicArn: 'arn:aws:sns:us-east-2:123456789012:sns-lambda',
            Subject: 'TestInvoke',
          },
        },
        {
          EventVersion: '1.0',
          EventSubscriptionArn:
            'arn:aws:sns:us-east-2:123456789012:sns-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
          EventSource: 'aws:sns',
          Sns: {
            SignatureVersion: '1',
            Timestamp: '2019-01-02T12:45:07.000Z',
            Signature: 'tcc6faL2yUC6dgZdmrwh1Y4cGa/ebXEkAi6RibDsvpi+tE/1+82j...65r==',
            SigningCertUrl:
              'https://sns.us-east-2.amazonaws.com/SimpleNotificationService-ac565b8b1a6c5d002d285f9598aa1d9b.pem',
            MessageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
            Message: 'Hello from SNS2!',
            MessageAttributes: {
              Test: { Type: 'String', Value: 'TestString' },
              TestBinary: { Type: 'Binary', Value: 'TestBinary' },
            },
            Type: 'Notification',
            UnsubscribeUrl:
              'https://sns.us-east-2.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-east-2:123456789012:test-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
            TopicArn: 'arn:aws:sns:us-east-2:123456789012:sns-lambda',
            Subject: 'TestInvoke',
          },
        },
      ],
    };

    const orderSnsEvent = EventParser.parseEvent(notOrderSnsEvent);

    expect(JSON.stringify(orderSnsEvent)).toEqual(
      JSON.stringify({
        Records: [
          {
            Sns: {
              Message: 'Hello from SNS1!',
              MessageAttributes: {
                Test: { Type: 'String', Value: 'TestString' },
                TestBinary: { Type: 'Binary', Value: 'TestBinary' },
              },
              MessageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
            },
          },
          {
            Sns: {
              Message: 'Hello from SNS2!',
              MessageAttributes: {
                Test: { Type: 'String', Value: 'TestString' },
                TestBinary: { Type: 'Binary', Value: 'TestBinary' },
              },
              MessageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
            },
          },
        ],
      })
    );
  });

  test('unknownEvent parse', () => {
    const unknownEvent = { a: 'a' };
    const spies = [
      jest.spyOn(EventChecker, 'isApiGwEvent'),
      jest.spyOn(EventChecker, 'isSnsEvent'),
      jest.spyOn(EventChecker, 'isSqsEvent'),
      jest.spyOn(EventChecker, 'isS3Event'),
      jest.spyOn(EventChecker, 'isCloudfrontEvent'),
    ];
    EventParser.parseEvent(unknownEvent);
    spies.forEach((spy) => {
      expect(spy.mock.results[0].type).toEqual('return');
      expect(spy.mock.results[0].value).toEqual(false);
    });
  });

  test('unknownEvent test', () => {
    let spy = jest.spyOn(EventParser, 'func2');
    EventParser.func2(1);
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });

  test('sqs parse', () => {
    const notOrderSqsEvent = {
      Records: [
        {
          messageId: '059f36b4-87a3-44ab-83d2-661975830a7d',
          receiptHandle: 'AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...',
          body: 'Test message1',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1545082649183',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1545082649185',
          },
          messageAttributes: { a: 1 },
          md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:my-queue',
          awsRegion: 'us-east-2',
        },
        {
          messageId: '2e1424d4-f796-459a-8184-9c92662be6da',
          receiptHandle: 'AQEBzWwaftRI0KuVm4tP+/7q1rGgNqicHq...',
          body: 'Test message2',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1545082650636',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1545082650649',
          },
          messageAttributes: { b: 2 },
          md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:my-queue',
          awsRegion: 'us-east-2',
        },
      ],
    };

    const orderSqsEvent = EventParser.parseEvent(notOrderSqsEvent);

    expect(JSON.stringify(orderSqsEvent)).toEqual(
      JSON.stringify({
        Records: [
          {
            body: 'Test message1',
            messageAttributes: { a: 1 },
            messageId: '059f36b4-87a3-44ab-83d2-661975830a7d',
          },
          {
            body: 'Test message2',
            messageAttributes: { b: 2 },
            messageId: '2e1424d4-f796-459a-8184-9c92662be6da',
          },
        ],
      })
    );
  });

  test('s3 parse', () => {
    const notOrderedS3Event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'us-west-2',
          eventTime: '2020-09-24T12:00:12.137Z',
          eventName: 'ObjectCreated:Put',
          userIdentity: { principalId: 'A2QVTU9T5VMOU3' },
          requestParameters: { sourceIPAddress: '77.127.93.97' },
          responseElements: {
            'x-amz-request-id': '318F33BA8C4CBDC5',
            'x-amz-id-2':
              'VyRyYV/2vjikRUkRoH2WPH6M5WcAjNSGXG8Qtd1uEfbklnTusaDEz/jQPdLQgf2tZLjRuq4MgZFcVFpQJgZLJfiGUoh7IBhU',
          },
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'a078ca2d-53a8-45d4-a621-260a439876d8',
            bucket: {
              name: 'testingbuckets3testing',
              ownerIdentity: { principalId: 'A2QVTU9T5VMOU3' },
              arn: 'arn:aws:s3:::testingbuckets3testing',
            },
            object: {
              key: 'Screen+Shot+2020-05-27+at+12.37.36.png',
              size: 61211,
              eTag: '714ee5196a5c0a6e6b9019caa7b6e970',
              sequencer: '005F6C8A510EE02021',
            },
          },
        },
      ],
    };

    const orderedS3Event = EventParser.parseEvent(notOrderedS3Event);

    expect(JSON.stringify(orderedS3Event)).toEqual(
      JSON.stringify({
        Records: [
          {
            awsRegion: 'us-west-2',
            eventTime: '2020-09-24T12:00:12.137Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'A2QVTU9T5VMOU3' },
            requestParameters: { sourceIPAddress: '77.127.93.97' },
            s3: {
              bucket: {
                arn: 'arn:aws:s3:::testingbuckets3testing',
              },
              object: {
                key: 'Screen+Shot+2020-05-27+at+12.37.36.png',
                size: 61211,
              },
            },
          },
        ],
      })
    );
  });

  test('cloudfront parse', () => {
    const notOrderedCloudfrontEvent = {
      Records: [
        {
          cf: {
            config: {
              distributionDomainName: 'd3f1hyel7d5adt.cloudfront.net',
              distributionId: 'E8PDQHVQH1V0Q',
              eventType: 'origin-request',
              requestId: 'hnql0vH8VDvTTLGwmKn337OH08mMiV5sTPsYGyBqCKgCXPZbfNqYlw==',
            },
            request: {
              body: {
                action: 'read-only',
                data: '',
                encoding: 'base64',
                inputTruncated: false,
              },
              clientIp: '176.12.196.206',
              headers: {
                'x-forwarded-for': [{ key: 'X-Forwarded-For', value: '176.12.196.206' }],
                'user-agent': [{ key: 'User-Agent', value: 'Amazon CloudFront' }],
                via: [
                  {
                    key: 'Via',
                    value: '1.1 67f7ae71b3a190dab6b84c5ceb7fd5e0.cloudfront.net (CloudFront)',
                  },
                ],
                'accept-encoding': [{ key: 'Accept-Encoding', value: 'gzip' }],
                host: [{ key: 'Host', value: 'my-cloudfront-demo-test.s3.amazonaws.com' }],
              },
              method: 'GET',
              origin: {
                s3: {
                  authMethod: 'none',
                  customHeaders: {},
                  domainName: 'my-cloudfront-demo-test.s3.amazonaws.com',
                  path: '',
                },
              },
              querystring: '',
              uri: '/favicon.ico',
            },
          },
        },
      ],
    };
    const orderedCloudfrontEvent = EventParser.parseEvent(notOrderedCloudfrontEvent);

    expect(JSON.stringify(orderedCloudfrontEvent)).toEqual(
      JSON.stringify({
        Records: [
          {
            cf: {
              config: {
                distributionDomainName: 'd3f1hyel7d5adt.cloudfront.net',
                distributionId: 'E8PDQHVQH1V0Q',
                eventType: 'origin-request',
                requestId: 'hnql0vH8VDvTTLGwmKn337OH08mMiV5sTPsYGyBqCKgCXPZbfNqYlw==',
              },
              request: {
                body: {
                  action: 'read-only',
                  data: '',
                  encoding: 'base64',
                  inputTruncated: false,
                },
                clientIp: '176.12.196.206',
                method: 'GET',
                querystring: '',
                uri: '/favicon.ico',
              },
            },
          },
        ],
      })
    );
  });
});
