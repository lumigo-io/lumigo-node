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

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    reporter.getEdgeHost.mockReturnValueOnce(edgeHost);
    reporter.getEdgeHost.mockReturnValueOnce(edgeHost);
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
    globals.SpansHive.addSpan = jest.fn(() => {});

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
    expect(globals.SpansHive.addSpan).toHaveBeenCalledWith(httpSpan);
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
    // const requestData = httpHook.parseHttpRequestOptions(options2);

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
