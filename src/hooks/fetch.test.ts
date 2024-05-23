import { NODE_MAJOR_VERSION } from '../../testUtils/nodeVersion';

describe('fetch', () => {
  if (NODE_MAJOR_VERSION < 18) {
    test('skip suite', () => {
      expect(true).toBe(true);
    });
    return;
  }

  test('beforeFetch', async () => {
    // @ts-ignore
    const response = await fetch('https://example.com/');

    expect(response.status).toBe(200);
  });
});
