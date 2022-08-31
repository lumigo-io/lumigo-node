import { TRACEPARENT_HEADER_NAME } from '../utils/w3cUtils';
import { W3CParser } from './w3c';

describe('W3C parser', () => {
  test('W3CParser', () => {
    const path = `google.com`;
    const headers = {
      [TRACEPARENT_HEADER_NAME]: '00-11111111111111111111111100000000-aaaaaaaaaaaaaaaa-01',
    };
    const requestData = { path, headers };
    const responseData = {};
    const expected = {
      messageId: 'aaaaaaaaaaaaaaaa',
    };
    expect(W3CParser(requestData, responseData)).toEqual(expected);
  });
});
