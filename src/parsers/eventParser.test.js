import { parse_event } from './eventParser';

describe('event parser', () => {
  test('check null value', () => {
    expect(parse_event(null)).toEqual(null);
  });

  test('api gw v1', () => {
    const not_order_api_gw_event = {
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
        'X-Amz-Cf-Id':
          'J4KbOEUrZCnUQSLsDq1PyYXmfpVy8x634huSeBX0HCbscgH-N2AtVA==',
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
        Via: [
          '2.0 59574f77a7cf2d23d64904db278e5711.cloudfront.net (CloudFront)',
        ],
        'X-Amz-Cf-Id': [
          'J4KbOEUrZCnUQSLsDq1PyYXmfpVy8x634huSeBX0HCbscgH-N2AtVA==',
        ],
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
            event_id: '9fe80735-f265-41d5-a7ca-04b88c2a4a4c',
            token_use: 'id',
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

    const order_api_gw_event = parse_event(not_order_api_gw_event);

    expect(JSON.stringify(order_api_gw_event)).toEqual(
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
              event_id: '9fe80735-f265-41d5-a7ca-04b88c2a4a4c',
              token_use: 'id',
              auth_time: '1587038744',
              exp: 'Sun Apr 19 08:06:14 UTC 2020',
              'custom:role': 'admin',
              iat: 'Sun Apr 19 07:06:14 UTC 2020',
              email: 'a@a.com',
            },
          },
        },
        headers: {
          Authorization: 'auth',
          'content-type': 'application/json;charset=UTF-8',
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
    const not_order_api_gw_event = {
      version: '2.0',
      routeKey: 'ANY /nodejs-apig-function-1G3XMPLZXVXYI',
      rawPath: '/default/nodejs-apig-function-1G3XMPLZXVXYI',
      rawQueryString: '',
      cookies: [
        's_fid=7AABXMPL1AFD9BBF-0643XMPL09956DE2',
        'regStatus=pre-register',
      ],
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

    const order_api_gw_event = parse_event(not_order_api_gw_event);

    expect(JSON.stringify(order_api_gw_event)).toEqual(
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
        },
        headers: {
          'content-length': '0',
          host: 'r3pmxmplak.execute-api.us-east-2.amazonaws.com',
          'upgrade-insecure-requests': '1',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
        },
        cookies: [
          's_fid=7AABXMPL1AFD9BBF-0643XMPL09956DE2',
          'regStatus=pre-register',
        ],
        isBase64Encoded: true,
      })
    );
  });
});
