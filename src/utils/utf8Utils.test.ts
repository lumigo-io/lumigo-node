import { runOneTimeWrapper } from './functionUtils';
import { Utf8Utils } from './utf8Utils';
import { encode } from 'utf8';

describe('Utf8Utils', () => {
  test('safeDecode -> simple flow', () => {
    const content = encode('€');

    const result = Utf8Utils.safeDecode(content);

    expect(result).toEqual('€');
  });

  test('safeDecode -> not utf8', () => {
    const content = 'Text';

    const result = Utf8Utils.safeDecode(content);

    expect(result).toEqual(content);
  });

  test('safeDecode -> empty', () => {
    const content = encode('');

    const result = Utf8Utils.safeDecode(content);

    expect(result).toEqual('');
  });

  test('safeDecode -> invalid continuation byte', () => {
    const content = 'a test of \xe9 char';

    const result = Utf8Utils.safeDecode(content);

    expect(result).toEqual('a test of é char');
  });
});
