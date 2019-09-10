import { lowerCaseObjectKeys } from '../utils';
import cloneResponse from 'clone-response';
import EventEmitter from 'events';
import defaultHttp from './http';
import MockDate from 'mockdate';
import shimmer from 'shimmer';
import crypto from 'crypto';
import https from 'https';
import http from 'http';

import * as httpHook from './http';
import * as utils from '../utils';

jest.mock('shimmer');
jest.mock('clone-response');

import * as awsSpan from '../spans/awsSpan';
jest.mock('../spans/awsSpan');

import * as globals from '../globals';
jest.mock('../globals');

jest.mock('../reporter');

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';
  process.env['_X_AMZN_TRACE_ID'] =
    'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';

  const spies = {};
  spies.wrappedHttpResponseCallback = jest.spyOn(
    httpHook,
    'wrappedHttpResponseCallback'
  );
  spies.getEdgeHost = jest.spyOn(utils, 'getEdgeHost');
  spies.randomBytes = jest.spyOn(crypto, 'randomBytes');
  spies.log = jest.spyOn(console, 'log');

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
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
      headers: expectedHeaders,
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
        host: 'asdf.io',
      },
      host: 'asdf.io',
      method: 'POST',
      path: '/yo.php',
      uri: 'asdf.io/yo.php',
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

    const retVal1 = { mock: 'value1' };
    spies.wrappedHttpResponseCallback.mockReturnValueOnce(retVal1);

    const expected1 = [options1, retVal1];
    expect(
      httpHook.getHookedClientRequestArgs(
        url1,
        options1,
        callback1,
        requestData1
      )
    ).toEqual(expected1);

    const url2 = 'https://xaws.com';
    const options2 = undefined;
    const callback2 = () => {};
    const requestData2 = { c: 'd' };

    const retVal2 = { mock: 'value2' };
    spies.wrappedHttpResponseCallback.mockReturnValueOnce(retVal2);

    const expected2 = [url2, retVal2];
    expect(
      httpHook.getHookedClientRequestArgs(
        url2,
        options2,
        callback2,
        requestData2
      )
    ).toEqual(expected2);

    const url3 = 'https://x.com';
    const options3 = undefined;
    const callback3 = undefined;
    const requestData3 = { c: 'd' };

    const expected3 = [url3];
    expect(
      httpHook.getHookedClientRequestArgs(
        url3,
        options3,
        callback3,
        requestData3
      )
    ).toEqual(expected3);

    const url4 = 'https://bla.amazonaws.com/asdf';
    const options4 = { headers: { 'Content-Type': 'text/plain' } };
    const callback4 = undefined;
    const requestData4 = { c: 'd' };
    const expected4 = [
      'https://bla.amazonaws.com/asdf',
      {
        headers: {
          'Content-Type': 'text/plain',
          //'X-Amzn-Trace-Id':
          //  'Root=1-00006161-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1',
        },
      },
    ];
    spies.randomBytes.mockReturnValueOnce(Buffer.from('aa'));

    expect(
      httpHook.getHookedClientRequestArgs(
        url4,
        options4,
        callback4,
        requestData4
      )
    ).toEqual(expected4);
  });

  test('httpRequestOnWrapper', () => {
    const requestData1 = { a: 'b' };
    const originalOnFn1 = jest.fn();
    const event1 = 'response';
    const callback1 = jest.fn();
    const retVal1 = 'xyz';

    const retWrappedCallback1 = jest.fn();
    spies.wrappedHttpResponseCallback.mockReturnValueOnce(retWrappedCallback1);
    originalOnFn1.mockReturnValueOnce(retVal1);

    expect(
      httpHook.httpRequestOnWrapper(requestData1)(originalOnFn1)(
        event1,
        callback1
      )
    ).toEqual(retVal1);

    expect(originalOnFn1).toHaveBeenCalledWith(event1, retWrappedCallback1);

    expect(spies.wrappedHttpResponseCallback).toHaveBeenCalledWith(
      requestData1,
      callback1
    );
    expect(retWrappedCallback1.__lumigoSentinel).toBe(true);

    const requestData2 = { a: 'b' };
    const originalOnFn2 = jest.fn();
    const event2 = 'something_else';
    const callback2 = jest.fn();
    const retVal2 = 'xyz';

    originalOnFn2.mockReturnValueOnce(retVal2);

    expect(
      httpHook.httpRequestOnWrapper(requestData2)(originalOnFn2)(
        event2,
        callback2
      )
    ).toEqual(retVal2);

    expect(originalOnFn2).toHaveBeenCalledWith(event2, callback2);
  });

  test('httpRequestWrapper', () => {
    const originalRequestFn = jest.fn();
    const edgeHost = 'edge-asdf.com';
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    const callback1 = jest.fn();

    // Blacklisted.
    const options1 = { host: edgeHost };
    httpHook.httpRequestWrapper(originalRequestFn)(options1, callback1);
    expect(originalRequestFn).toHaveBeenCalledWith(options1, callback1);

    originalRequestFn.mockClear();

    // Already traced.
    const options3 = { host: 'bla.com' };
    const callback3 = jest.fn();
    callback3.__lumigoSentinel = true;
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    httpHook.httpRequestWrapper(originalRequestFn)(options3, callback3);
    expect(originalRequestFn).toHaveBeenCalledWith(options3, callback3);

    originalRequestFn.mockClear();

    // Error within Lumigo's code.
    const options5 = { host: 'bla.com' };
    const callback5 = jest.fn();
    spies.log.mockClear();
    spies.log.mockReturnValueOnce(null);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    originalRequestFn.mockImplementationOnce(() => {
      throw new Error();
    });

    httpHook.httpRequestWrapper(originalRequestFn)(options5, callback5);
    expect(originalRequestFn).toHaveBeenCalledTimes(2);
    expect(originalRequestFn).toHaveBeenCalledWith(
      options5,
      expect.any(Function)
    );
    expect(spies.log).toHaveBeenCalled();
    originalRequestFn.mockClear();

    spies.randomBytes.mockReturnValueOnce(Buffer.from('aa'));
    // Regular case
    const options2 = {
      host: 'baba.amazonaws.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers: { X: 'Y' },
    };

    const callback2 = jest.fn();

    const clientRequest = { a: 'b' };
    originalRequestFn.mockReturnValueOnce(clientRequest);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);

    const expectedHeaders2 = {
      X: 'Y',
      ['X-Amzn-Trace-Id']:
        'Root=1-00006161-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1',
    };
    const expectedOptions2 = Object.assign({}, options2, {
      headers: expectedHeaders2,
    });
    expect(
      httpHook.httpRequestWrapper(originalRequestFn)(options2, callback2)
    ).toEqual(clientRequest);

    expect(originalRequestFn).toHaveBeenCalledWith(
      expectedOptions2,
      expect.any(Function)
    );

    originalRequestFn.mockClear();
    // No callback provided case
    const options4 = {
      host: 'asdf1.com',
      port: 443,
      protocol: 'https:',
      path: '/api/where/is/satoshi',
      method: 'POST',
      headers: { X: 'Y' },
    };

    const clientRequest4 = { a: 'b' };
    originalRequestFn.mockReturnValueOnce(clientRequest4);
    utils.getEdgeHost.mockReturnValueOnce(edgeHost);
    expect(httpHook.httpRequestWrapper(originalRequestFn)(options4)).toEqual(
      clientRequest4
    );

    expect(originalRequestFn).toHaveBeenCalledWith(options4);

    expect(shimmer.wrap).toHaveBeenCalledWith(
      clientRequest4,
      'on',
      expect.any(Function)
    );
  });

  test('httpGetWrapper', () => {
    const retVal = 'endCalled';
    const end = jest.fn(() => retVal);
    const req = { end };
    const request = jest.fn(() => req);
    const httpModule = { request };
    const fn = httpHook.httpGetWrapper(httpModule)();

    const args = ['x', 'y', 'z'];
    expect(fn(args)).toEqual(req);
    expect(httpModule.request).toHaveBeenCalledWith(args);
    expect(end).toHaveBeenCalled();
  });

  test('export default', () => {
    defaultHttp();
    expect(shimmer.wrap).toHaveBeenCalledWith(
      http,
      'request',
      httpHook.httpRequestWrapper
    );
    expect(shimmer.wrap).toHaveBeenCalledWith(
      https,
      'request',
      httpHook.httpRequestWrapper
    );
    expect(shimmer.wrap).toHaveBeenCalledWith(
      https,
      'get',
      expect.any(Function)
    );
    expect(shimmer.wrap).toHaveBeenCalledWith(
      https,
      'get',
      expect.any(Function)
    );
  });
});
