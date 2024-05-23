/*
 * @group node18
 */
const [nodeVersionMajor] = process.versions.node.split('.').map(Number);
describe('fetch', () => {
  if (nodeVersionMajor < 18) {
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
