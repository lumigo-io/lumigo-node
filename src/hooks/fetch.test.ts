/*
 * @group node18
 */
describe('fetch', () => {
  test('beforeFetch', async () => {
    // @ts-ignore
    const response = await fetch('https://example.com/');

    expect(response.status).toBe(200);
  });
});
