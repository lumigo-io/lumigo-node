describe('onlynode18 - fetch', () => {
  test('beforeFetch', async () => {
    // @ts-ignore
    const response = await fetch('https://example.com/');

    expect(response.status).toBe(200);
  });
});
