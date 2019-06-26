import MockDate from 'mockdate';
import { lowerCaseObjectKeys } from '../utils';
import defaultHttp from './http';
import * as httpHook from './http';
import shimmer from 'shimmer';
import http from 'http';

jest.mock('shimmer');

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    expect(httpHook.isBlacklisted(host)).toBe(false);
    expect(httpHook.isBlacklisted(edgeHost)).toBe(true);
  });

  test('getHostFromOptions', () => {
    const options1 = { host: 'asdf1.com' };
    const options2 = { hostname: 'asdf2.com' };
    const options3 = { uri: { hostname: 'asdf3.com' } };
    const options4 = {};
    expect(httpHook.getHostFromOptions(options1)).toEqual('asdf1.com');
    expect(httpHook.getHostFromOptions(options2)).toEqual('asdf2.com');
    expect(httpHook.getHostFromOptions(options3)).toEqual('asdf3.com');
    expect(httpHook.getHostFromOptions(options4)).toEqual('localhost');
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
    const expected1 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers: lowerCaseObjectKeys(headers),
      sendTime,
      body: '',
    };
    expect(httpHook.parseHttpRequestOptions(options1)).toEqual(expected1);
  });

  test('httpRequestEndWrapper', () => {
    const originalEndFn = jest.fn();
    const body = 'abcdefg';
    const requestData = { body: '' };

    const data = body;
    const encoding = 'utf8';
    const callback = jest.fn();
    httpHook.httpRequestEndWrapper(requestData)(originalEndFn)(
      data,
      encoding,
      callback
    );

    expect(requestData).toEqual({ body });
    expect(originalEndFn).toHaveBeenCalledWith(data, encoding, callback);
  });

  test('export default', () => {
    defaultHttp();
    expect(shimmer.wrap).toHaveBeenCalledWith(
      http,
      'request',
      httpHook.httpRequestWrapper
    );
  });
});
