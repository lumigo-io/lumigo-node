/*
 * @group node18
 */
const [nodeVersionMajor] = process.versions.node.split('.').map(Number);
if (nodeVersionMajor >= 18) {
  describe('fetch', () => {
    test('beforeFetch', async () => {
      // @ts-ignore
      const response = await fetch('https://example.com/');

      expect(response.status).toBe(200);
    });
  });
}
