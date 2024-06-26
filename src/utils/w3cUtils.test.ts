import { Utf8Utils } from './utf8Utils';
import {
  addW3CTracePropagator,
  getW3CMessageId,
  shouldSkipTracePropagation,
  TRACEPARENT_HEADER_NAME,
  TRACESTATE_HEADER_NAME,
} from './w3cUtils';
import * as awsSpan from '../spans/awsSpan';

describe('Utf8Utils', () => {
  const spies = {
    getCurrentTransactionId: jest.spyOn(awsSpan, 'getCurrentTransactionId'),
  };

  test('addW3CTracePropagator -> existing header happy flow', () => {
    const headers = {
      [TRACEPARENT_HEADER_NAME]: '00-11111111111111111111111100000000-aaaaaaaaaaaaaaaa-01',
      [TRACESTATE_HEADER_NAME]: 'old',
    };
    spies.getCurrentTransactionId.mockReturnValueOnce('111111111111112222222222');

    addW3CTracePropagator(headers);

    const parts = headers[TRACEPARENT_HEADER_NAME].split('-');
    expect(parts.length).toEqual(4);
    expect(parts[0]).toEqual('00');
    expect(parts[1]).toEqual('11111111111111111111111100000000');
    expect(parts[3]).toEqual('01');
    expect(headers[TRACESTATE_HEADER_NAME]).toEqual(`old,lumigo=${parts[2]}`);
  });

  test('addW3CTracePropagator -> no header happy flow', () => {
    const headers = {};
    spies.getCurrentTransactionId.mockReturnValueOnce('111111111111112222222222');

    addW3CTracePropagator(headers);

    const parts = headers[TRACEPARENT_HEADER_NAME].split('-');
    expect(parts.length).toEqual(4);
    expect(parts[0]).toEqual('00');
    expect(parts[1]).toEqual('11111111111111222222222200000000');
    expect(parts[3]).toEqual('01');
    expect(headers[TRACESTATE_HEADER_NAME]).toEqual(`lumigo=${parts[2]}`);
  });

  test('addW3CTracePropagator -> malformed header', () => {
    const headers = { [TRACEPARENT_HEADER_NAME]: 'something else-aaaaaaaaaaaaaaaa-01' };
    spies.getCurrentTransactionId.mockReturnValueOnce('111111111111112222222222');

    addW3CTracePropagator(headers);

    const parts = headers[TRACEPARENT_HEADER_NAME].split('-');
    expect(parts.length).toEqual(4);
    expect(parts[0]).toEqual('00');
    expect(parts[1]).toEqual('11111111111111222222222200000000');
    expect(parts[3]).toEqual('01');
    expect(headers[TRACESTATE_HEADER_NAME]).toEqual(`lumigo=${parts[2]}`);
  });

  [
    { 'x-amz-content-sha256': '123' },
    { 'x-amz-content-sha256': '123', 'Content-Type': 'application/json' },
  ].map((headers) => {
    test(`aaddW3CTracePropagator -> no new headers added when sha256 header present`, () => {
      const originalHeaders = { ...headers };
      const returnedHeaders = addW3CTracePropagator(headers);
      expect(headers).toEqual(originalHeaders);
      expect(returnedHeaders).toEqual(originalHeaders);
    });
  });

  test('getW3CMessageId -> happy flow', () => {
    const headers = {
      [TRACEPARENT_HEADER_NAME]: '00-11111111111111111111111100000000-aaaaaaaaaaaaaaaa-01',
    };
    expect(getW3CMessageId(headers)).toEqual('aaaaaaaaaaaaaaaa');
  });

  test('getW3CMessageId -> malformed header', () => {
    const headers = { [TRACEPARENT_HEADER_NAME]: 'something else-aaaaaaaaaaaaaaaa-01' };
    expect(getW3CMessageId(headers)).toBeFalsy();
  });

  test('getW3CMessageId -> shouldSkipTracePropagation', () => {
    expect(shouldSkipTracePropagation({})).toBeFalsy();
    expect(shouldSkipTracePropagation({ another: 'header' })).toBeFalsy();
    expect(shouldSkipTracePropagation({ 'x-amz-content-sha256': '123' })).toBeTruthy();
    expect(shouldSkipTracePropagation({ 'X-amz-content-SHA256': '123' })).toBeTruthy();
  });

  test('getW3CMessageId -> dont add header to skipped context', () => {
    const headers = { 'x-amz-content-sha256': '123' };
    spies.getCurrentTransactionId.mockReturnValueOnce('111111111111112222222222');

    addW3CTracePropagator(headers);

    expect(headers).toEqual({ 'x-amz-content-sha256': '123' });
  });
});
