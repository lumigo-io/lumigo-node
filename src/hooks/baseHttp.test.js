import MockDate from 'mockdate';
import * as shimmer from 'shimmer';
import { HttpsMocker } from '../../testUtils/httpsMocker';
import { lowerCaseObjectKeys, LUMIGO_SECRET_MASKING_REGEX_HTTP_QUERY_PARAMS } from '../utils';

import { TracerGlobals } from '../globals';
import { BaseHttp } from './baseHttp';

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';
  process.env['_X_AMZN_TRACE_ID'] =
    'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';

  const spies = {};
  spies.shimmer = jest.spyOn(shimmer, 'wrap');

  beforeEach(() => {
    spies.shimmer.mockClear();
    shimmer.unwrap(HttpsMocker, 'request');
  });

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    TracerGlobals.setTracerInputs({ ...TracerGlobals.getTracerInputs(), edgeHost });
    expect(BaseHttp.isBlacklisted(host)).toBe(false);
    expect(BaseHttp.isBlacklisted(edgeHost)).toBe(true);
  });

  test('aggregateRequestBodyToSpan ->  happy flow', () => {
    const currentSpan = {
      info: {
        httpInfo: {},
      },
    };
    BaseHttp.aggregateRequestBodyToSpan(
      'a',
      {
        body: 'a',
        host: 'host',
      },
      currentSpan
    );
    expect(currentSpan).toEqual({
      info: {
        httpInfo: {
          host: 'host',
          request: {
            body: 'aa',
            host: 'host',
            truncated: false,
          },
          response: {},
        },
      },
    });
  });

  test('aggregateRequestBodyToSpan ->  missing resource name on span and adding it on end event', () => {
    const currentSpan = {
      info: {
        resourceName: '',
        httpInfo: {},
      },
    };
    BaseHttp.aggregateRequestBodyToSpan(
      ',"Item":{"id":{"S":"5590.195458064029"},"message":{"S":"DummyMessage"}}}',
      {
        truncated: false,
        uri: 'dynamodb.us-east-1.amazonaws.com/',
        host: 'dynamodb.us-east-1.amazonaws.com',
        headers: {
          'x-amz-target': 'DynamoDB_20120810.PutItem',
          host: 'dynamodb.us-east-1.amazonaws.com',
        },
        body: '{"TableName":"test-table"',
      },
      currentSpan
    );
    expect(currentSpan).toEqual({
      info: {
        resourceName: 'test-table',
        httpInfo: {
          host: 'dynamodb.us-east-1.amazonaws.com',
          request: {
            truncated: false,
            uri: 'dynamodb.us-east-1.amazonaws.com/',
            host: 'dynamodb.us-east-1.amazonaws.com',
            headers: {
              'x-amz-target': 'DynamoDB_20120810.PutItem',
              host: 'dynamodb.us-east-1.amazonaws.com',
            },
            body: '{"TableName":"test-table","Item":{"id":{"S":"5590.195458064029"},"message":{"S":"DummyMessage"}}}',
          },
          response: {},
        },
        dynamodbMethod: 'PutItem',
        messageId: '546fb5c2a83410ebeba6a7c9b1324a04',
      },
    });
  });

  test('aggregateRequestBodyToSpan ->  should truncate body', () => {
    const currentSpan = {
      info: {
        httpInfo: {},
      },
    };
    BaseHttp.aggregateRequestBodyToSpan(
      'a',
      {
        body: 'a',
        host: 'host',
      },
      currentSpan,
      1
    );
    expect(currentSpan).toEqual({
      info: {
        httpInfo: {
          host: 'host',
          request: {
            body: 'a',
            host: 'host',
            truncated: true,
          },
          response: {},
        },
      },
    });
  });

  test('aggregateRequestBodyToSpan ->  already truncated', () => {
    const currentSpan = {
      info: {
        httpInfo: {},
      },
    };
    BaseHttp.aggregateRequestBodyToSpan(
      'a',
      {
        body: 'a',
        host: 'host',
        truncated: true,
      },
      currentSpan,
      100
    );
    expect(currentSpan).toEqual({
      info: {
        httpInfo: {
          host: 'host',
          request: {
            body: 'a',
            host: 'host',
            truncated: true,
          },
          response: {},
        },
      },
    });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(str)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';

    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    wrapper([firstArg]);

    expect(requestData).toEqual({ body: 'BODY', truncated: false });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer)', () => {
    const requestData = {
      body: '',
    };
    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    const firstArg = Buffer.from('BODY');

    wrapper([firstArg]);

    expect(requestData).toEqual({ body: 'BODY', truncated: false });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer, encoding)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';
    const secArg = 'base64';

    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    wrapper([firstArg, secArg]);

    expect(requestData).toEqual({ body: 'Qk9EWQ==', truncated: false });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer, encoding, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = Buffer.from('BODY');
    const secArg = 'utf8';
    const thirdArg = () => {};

    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    wrapper([firstArg, secArg, thirdArg]);

    expect(requestData).toEqual({ body: 'BODY', truncated: false });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(Buffer, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = Buffer.from('BODY');
    const secArg = () => {};

    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    wrapper([firstArg, secArg]);

    expect(requestData).toEqual({ body: 'BODY', truncated: false });
  });

  test('httpRequestWriteBeforeHookWrapper -> simple flow -> write(str, callback)', () => {
    const requestData = {
      body: '',
    };

    const firstArg = 'BODY';
    const secArg = () => {};

    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    wrapper([firstArg, secArg]);

    expect(requestData).toEqual({ body: 'BODY', truncated: false });
  });

  test('httpRequestWriteBeforeHookWrapper -> not override body', () => {
    const requestData = {
      body: 'BODY1',
    };

    const firstArg = Buffer.from('BODY2');

    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    wrapper([firstArg]);

    expect(requestData).toEqual({ body: 'BODY1' });
  });

  test('httpRequestWriteBeforeHookWrapper -> not crashed on bad data', () => {
    const requestData = {
      body: '',
    };

    const firstArg = {};
    const secArg = {};

    const wrapper = BaseHttp.createRequestDataWriteHandler({ requestData });
    wrapper(firstArg, secArg);

    expect(requestData).toEqual({ body: '' });
  });

  test('getHostFromOptionsOrUrl', () => {
    const options1 = { host: 'asdf1.com' };
    const options2 = { hostname: 'asdf2.com' };
    const options3 = { uri: { hostname: 'asdf3.com' } };
    const options4 = {};
    expect(BaseHttp._getHostFromOptionsOrUrl({ options: options1 })).toEqual('asdf1.com');
    expect(BaseHttp._getHostFromOptionsOrUrl({ options: options2 })).toEqual('asdf2.com');
    expect(BaseHttp._getHostFromOptionsOrUrl({ options: options3 })).toEqual('asdf3.com');
    expect(BaseHttp._getHostFromOptionsOrUrl({ options: options4 })).toEqual('localhost');

    const url1 = 'https://asdf.io:1234/yo?ref=baba';
    expect(BaseHttp._getHostFromOptionsOrUrl({ options: {}, url: url1 })).toEqual('asdf.io');
  });

  test('parseHttpRequestOptions', () => {
    const headers = { X: 'Y', Z: 'A' };
    const options1 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers,
    };
    const sendTime = 895179612345;
    MockDate.set(sendTime);

    const expectedHeaders = lowerCaseObjectKeys({
      ...headers,
      ...{ host: 'asdf1.com' },
    });

    const expected1 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      uri: 'asdf1.com/api/where/is/satoshi',
      method: 'POST',
      truncated: false,
      headers: expectedHeaders,
      sendTime,
      body: '',
    };
    expect(BaseHttp.parseHttpRequestOptions(options1)).toEqual(expected1);

    const url2 = 'https://asdf.io:1234/yo.php?ref=baba';
    const options2 = { headers, method: 'POST' };
    const expected2 = {
      body: '',
      headers: {
        x: 'Y',
        z: 'A',
        host: 'asdf.io',
      },
      host: 'asdf.io',
      method: 'POST',
      path: '/yo.php',
      truncated: false,
      uri: 'asdf.io/yo.php?ref=baba',
      port: '1234',
      protocol: 'https:',
      sendTime: 895179612345,
    };

    expect(BaseHttp.parseHttpRequestOptions(options2, url2)).toEqual(expected2);
  });

  test('parseHttpRequestOptions - scrub query params', () => {
    const sendTime = 895179612345;
    MockDate.set(sendTime);

    const headers = { X: 'Y', Z: 'A' };

    const url2 = 'https://asdf.io:1234/yo.php?ref=baba&password=1234';
    const options2 = { headers, method: 'POST' };
    const expected2 = {
      body: '',
      headers: {
        x: 'Y',
        z: 'A',
        host: 'asdf.io',
      },
      host: 'asdf.io',
      method: 'POST',
      path: '/yo.php',
      truncated: false,
      uri: 'asdf.io/yo.php?ref=baba&password=****',
      port: '1234',
      protocol: 'https:',
      sendTime: 895179612345,
    };

    expect(BaseHttp.parseHttpRequestOptions(options2, url2)).toEqual(expected2);
  });

  test('httpRequestEndWrapper', () => {
    const body = 'abcdefg';
    const requestData = { body: '' };

    const data = body;
    const encoding = 'utf8';
    const callback = jest.fn();
    BaseHttp.createRequestDataWriteHandler({ requestData })([data, encoding, callback]);

    expect(requestData).toEqual({ body: body, truncated: false });
  });

  test('scrubQueryParams', () => {
    expect(BaseHttp.scrubQueryParams('?password=123')).toEqual('?password=****');
    expect(BaseHttp.scrubQueryParams('?plain=123')).toEqual('?plain=123');
    expect(BaseHttp.scrubQueryParams('?password=123&plain=123')).toEqual(
      '?password=****&plain=123'
    );
    expect(BaseHttp.scrubQueryParams('?password=123&plain=123&secret=123')).toEqual(
      '?password=****&plain=123&secret=****'
    );
    process.env[LUMIGO_SECRET_MASKING_REGEX_HTTP_QUERY_PARAMS] = '["plain"]';
    expect(BaseHttp.scrubQueryParams('?plain=123&bla=123')).toEqual('?plain=****&bla=123');

    expect(BaseHttp.scrubQueryParams(1234)).toEqual('');
  });
});
