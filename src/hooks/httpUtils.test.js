import {
  extractBodyFromEmitSocketEvent,
  extractBodyFromWriteOrEndFunc,
  isValidHttpRequestBody,
} from './httpUtils';
import { getEventEntitySize } from '../utils';

describe('httpUtils', () => {
  test('extractBodyFromSocketEvent -> outputData flow', () => {
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        outputData: [{ data: 'HTTP BODY1\nHTTP BODY2' }],
      },
    };

    const result = extractBodyFromEmitSocketEvent(emitArg);

    expect(result).toEqual('HTTP BODY2');
  });

  test('extractBodyFromSocketEvent -> output flow', () => {
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        output: ['HTTP BODY1\nHTTP BODY2'],
      },
    };

    const result = extractBodyFromEmitSocketEvent(emitArg);

    expect(result).toEqual('HTTP BODY2');
  });

  test('extractBodyFromSocketEvent -> not crashed on bad data', () => {
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        output: -1,
      },
    };

    const result = extractBodyFromEmitSocketEvent(emitArg);

    expect(result).toEqual(undefined);
  });

  test('extractBodyFromWriteOrEndFunc -> simple flow -> write(str)', () => {
    const firstArg = 'BODY';

    const result = extractBodyFromWriteOrEndFunc([firstArg]);

    expect(result[0]).toEqual('BODY');
    expect(result[1]).toEqual(false);
  });

  test('extractBodyFromWriteOrEndFunc -> simple flow -> write(Buffer)', () => {
    const firstArg = Buffer.from('BODY');

    const result = extractBodyFromWriteOrEndFunc([firstArg]);

    expect(result[0]).toEqual('BODY');
    expect(result[1]).toEqual(false);
  });

  test('extractBodyFromWriteOrEndFunc -> simple flow -> write(Buffer, encoding)', () => {
    const firstArg = 'BODY';
    const secArg = 'base64';

    const result = extractBodyFromWriteOrEndFunc([firstArg, secArg]);

    expect(result[0]).toEqual('Qk9EWQ==');
    expect(result[1]).toEqual(false);
  });

  test('extractBodyFromWriteOrEndFunc -> simple flow -> write(Buffer, encoding, callback)', () => {
    const firstArg = Buffer.from('BODY');
    const secArg = 'base64';
    const thirdArg = () => {};

    const result = extractBodyFromWriteOrEndFunc([firstArg, secArg, thirdArg]);

    expect(result[0]).toEqual('BODY');
    expect(result[1]).toEqual(false);
  });

  test('extractBodyFromWriteOrEndFunc -> simple flow -> write(Buffer, callback)', () => {
    const firstArg = Buffer.from('BODY');
    const secArg = () => {};

    const result = extractBodyFromWriteOrEndFunc([firstArg, secArg]);

    expect(result[0]).toEqual('BODY');
    expect(result[1]).toEqual(false);
  });

  test('extractBodyFromWriteOrEndFunc -> simple flow -> write(str, callback)', () => {
    const firstArg = 'BODY';
    const secArg = () => {};

    const result = extractBodyFromWriteOrEndFunc([firstArg, secArg]);

    expect(result[0]).toEqual('BODY');
    expect(result[1]).toEqual(false);
  });

  test('extractBodyFromWriteOrEndFunc -> long firstArg should be truncated', () => {
    const firstArg = '#'.repeat(getEventEntitySize(false)) + '#';
    const secArg = () => {};

    const result = extractBodyFromWriteOrEndFunc([firstArg, secArg]);
    expect(result[1]).toEqual(true);
  });

  test('isValidHttpRequestBody - simple flow', () => {
    expect(isValidHttpRequestBody('BODY')).toEqual(true);
    expect(isValidHttpRequestBody(Buffer.from('BODY'))).toEqual(true);
  });

  test('isValidHttpRequestBody -> empty flow', () => {
    expect(isValidHttpRequestBody()).toEqual(false);
    expect(isValidHttpRequestBody('')).toEqual(false);
    expect(isValidHttpRequestBody(0)).toEqual(false);
    expect(isValidHttpRequestBody([])).toEqual(false);
    expect(isValidHttpRequestBody({})).toEqual(false);
    expect(isValidHttpRequestBody(undefined)).toEqual(false);
    expect(isValidHttpRequestBody(null)).toEqual(false);
  });
});
