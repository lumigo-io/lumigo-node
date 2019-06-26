import * as httpHook from './http';

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';

  test('isBlacklisted', () => {
    const host = 'asdf';
    const edgeHost = 'us-east-x.lumigo-tracer-edge.golumigo.com';
    expect(httpHook.isBlacklisted(host)).toBe(false);
    expect(httpHook.isBlacklisted(edgeHost)).toBe(true);
  });

  test('getHostFromOptions', () => {
    const options1 = { host: 'asdf1.com' };
    const options2 = { hostname: 'asdf2.com' };
    const options3 = { uri: { hostname: 'asdf3.com' } };
    const options4 = {};
    expect(httpHook.getHostFromOptions(options1)).toEqual('asdf1.com');
    expect(httpHook.getHostFromOptions(options2)).toEqual('asdf2.com');
    expect(httpHook.getHostFromOptions(options3)).toEqual('asdf3.com');
    expect(httpHook.getHostFromOptions(options4)).toEqual('localhost');
  });
});
