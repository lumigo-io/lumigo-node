import { lowerCaseObjectKeys } from '../utils';
import cloneResponse from 'clone-response';
import EventEmitter from 'events';
import defaultHttp from './http';
import MockDate from 'mockdate';
import shimmer from 'shimmer';
import http from 'http';

import * as httpHook from './http';

jest.mock('shimmer');
jest.mock('clone-response');

import * as awsSpan from '../spans/awsSpan';
jest.mock('../spans/awsSpan');

import * as globals from '../globals';
jest.mock('../globals');

import * as reporter from '../reporter';
jest.mock('../reporter');

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';
  const spies = {};
  spies.wrappedHttpResponseCallback = jest.spyOn(
    httpHook,
    'wrappedHttpResponseCallback'
  );

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    reporter.getEdgeHost.mockReturnValueOnce(edgeHost);
    reporter.getEdgeHost.mockReturnValueOnce(edgeHost);
    expect(httpHook.isBlacklisted(host)).toBe(false);
    expect(httpHook.isBlacklisted(edgeHost)).toBe(true);
  });

  test('getHostFromOptionsOrUrl', () => {
    const options1 = { host: 'asdf1.com' };
    const options2 = { hostname: 'asdf2.com' };
    const options3 = { uri: { hostname: 'asdf3.com' } };
    const options4 = {};
    expect(httpHook.getHostFromOptionsOrUrl(options1)).toEqual('asdf1.com');
    expect(httpHook.getHostFromOptionsOrUrl(options2)).toEqual('asdf2.com');
    expect(httpHook.getHostFromOptionsOrUrl(options3)).toEqual('asdf3.com');
    expect(httpHook.getHostFromOptionsOrUrl(options4)).toEqual('localhost');

    const url1 = 'https://asdf.io:1234/yo?ref=baba';
    expect(httpHook.getHostFromOptionsOrUrl({}, url1)).toEqual('asdf.io');
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

    const url2 = 'https://asdf.io:1234/yo.php?ref=baba';
    const options2 = { headers, method: 'POST' };
    const expected2 = {
      body: '',
      headers: {
        x: 'Y',
        z: 'A',
      },
      host: 'asdf.io',
      method: 'POST',
      path: '/yo.php',
      port: '1234',
      protocol: 'https:',
      sendTime: 895179612345,
    };

    expect(httpHook.parseHttpRequestOptions(options2, url2)).toEqual(expected2);
  });

  test('wrappedHttpResponseCallback', () => {
    const statusCode = 200;
    const headers = { X: 'Y', z: 'A' };

    const callback = jest.fn();
    const clonedResponse1 = new EventEmitter();
    clonedResponse1.headers = headers;
    clonedResponse1.statusCode = statusCode;

    const clonedResponse2 = new EventEmitter();
    cloneResponse.mockReturnValueOnce(clonedResponse1);
    cloneResponse.mockReturnValueOnce(clonedResponse2);

    const receivedTime = 895179612345;
    MockDate.set(receivedTime);

    const requestData = { a: 'request' };
    const response = {};

    const httpSpan = { a: 'b', c: 'd' };
    globals.SpansContainer.addSpan = jest.fn(() => {});

    awsSpan.getHttpSpan.mockReturnValueOnce(httpSpan);

    httpHook.wrappedHttpResponseCallback(requestData, callback)(response);
    expect(callback).toHaveBeenCalledWith(clonedResponse2);

    clonedResponse1.emit('data', 'chunky');
    clonedResponse1.emit('end');

    expect(awsSpan.getHttpSpan).toHaveBeenCalledWith(requestData, {
      statusCode,
      body: 'chunky',
      headers: lowerCaseObjectKeys(headers),
      receivedTime,
    });
    expect(globals.SpansContainer.addSpan).toHaveBeenCalledWith(httpSpan);
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

  test('httpRequestArguments', () => {
    expect(() => httpHook.httpRequestArguments([])).toThrow(
      new Error('http/s.request(...) was called without any arguments.')
    );

    const expected1 = {
      url: 'https://x.com',
      options: undefined,
      callback: undefined,
    };
    expect(httpHook.httpRequestArguments(['https://x.com'])).toEqual(expected1);

    const callback = () => {};

    const expected2 = {
      url: 'https://x.com',
      options: undefined,
      callback,
    };
    expect(httpHook.httpRequestArguments(['https://x.com', callback])).toEqual(
      expected2
    );

    const options = { a: 'b' };
    const expected3 = {
      url: 'https://x.com',
      options,
      callback,
    };
    expect(
      httpHook.httpRequestArguments(['https://x.com', options, callback])
    ).toEqual(expected3);

    const expected4 = {
      url: undefined,
      options,
      callback,
    };
    expect(httpHook.httpRequestArguments([options, callback])).toEqual(
      expected4
    );
  });

  test('getHookedClientRequestArgs', () => {
    const url1 = undefined;
    const options1 = { a: 'b' };
    const callback1 = () => {};
    const requestData1 = { c: 'd' };

    const fnMockStr1 = 'fn mock1';
    spies.wrappedHttpResponseCallback.mockReturnValueOnce(fnMockStr1);

    const expected1 = [options1, fnMockStr1];
    expect(
      httpHook.getHookedClientRequestArgs(
        url1,
        options1,
        callback1,
        requestData1
      )
    ).toEqual(expected1);

    const url2 = 'https://x.com';
    const options2 = undefined;
    const callback2 = () => {};
    const requestData2 = { c: 'd' };

    const fnMockStr2 = 'fn mock2';
    spies.wrappedHttpResponseCallback.mockReturnValueOnce(fnMockStr2);

    const expected2 = [url2, fnMockStr2];
    expect(
      httpHook.getHookedClientRequestArgs(
        url2,
        options2,
        callback2,
        requestData2
      )
    ).toEqual(expected2);
  });

  test('httpRequestWrapper', () => {
    const originalRequestFn = jest.fn();
    const edgeHost = 'edge-asdf.com';
    reporter.getEdgeHost.mockReturnValueOnce(edgeHost);
    const callback1 = jest.fn();

    // Blacklisted.
    const options1 = { host: edgeHost };
    httpHook.httpRequestWrapper(originalRequestFn)(options1, callback1);
    expect(originalRequestFn).toHaveBeenCalledWith(options1, callback1);
    originalRequestFn.mockClear();

    const options2 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers: { X: 'Y' },
    };

    const callback2 = jest.fn();

    const clientRequest = { a: 'b' };
    originalRequestFn.mockReturnValueOnce(clientRequest);

    expect(
      httpHook.httpRequestWrapper(originalRequestFn)(options2, callback2)
    ).toEqual(clientRequest);

    expect(originalRequestFn).toHaveBeenCalledWith(
      options2,
      expect.any(Function)
    );
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
