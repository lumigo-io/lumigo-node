import { AxiosMocker } from '../testUtils/axiosMocker';
import * as globals from './globals';
import { HttpSpansAgent } from './httpSpansAgent';
import * as utils from './utils';

import axios from 'axios';
import { sleep } from '../testUtils/sleep';

describe('HttpSpansAgent', () => {
  test('postSpans - simple flow', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });
    const { url } = utils.getEdgeUrl();

    await HttpSpansAgent.postSpans(reqBody);

    const requests = AxiosMocker.getAxiosMocker().history.post;
    expect(requests.length).toEqual(1);
    expect(JSON.parse(requests[0].data)).toEqual(reqBody);

    expect(requests[0].headers['Accept']).toEqual('application/json, text/plain, */*');
    expect(requests[0].headers['Content-Type']).toEqual('application/json');
    expect(requests[0].headers['Authorization']).toEqual('t_xxx');
    expect(requests[0].headers['Accept']).toEqual('application/json, text/plain, */*');
    expect(requests[0].headers['User-Agent']).toEqual('@lumigo/tracerMock$1.2.3');

    expect(requests[0].timeout).toEqual(300);
    expect(requests[0].url).toEqual(url);
    expect(requests[0].httpsAgent).toBeUndefined();
  });

  test('postSpans - keepalive flag', async () => {
    const reqBody = 'abcdefg';
    process.env['LUMIGO_REUSE_HTTP_CONNECTION'] = 'TRUE';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });
    const { url } = utils.getEdgeUrl();

    await HttpSpansAgent.postSpans(reqBody);

    const requests = AxiosMocker.getAxiosMocker().history.post;
    expect(requests.length).toEqual(1);
    expect(JSON.parse(requests[0].data)).toEqual(reqBody);

    expect(requests[0].headers['Accept']).toEqual('application/json, text/plain, */*');
    expect(requests[0].headers['Content-Type']).toEqual('application/json');
    expect(requests[0].headers['Authorization']).toEqual('t_xxx');
    expect(requests[0].headers['Accept']).toEqual('application/json, text/plain, */*');
    expect(requests[0].headers['User-Agent']).toEqual('@lumigo/tracerMock$1.2.3');

    expect(requests[0].timeout).toEqual(300);
    expect(requests[0].url).toEqual(url);
  });

  test('postSpans - reject 500', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });

    AxiosMocker.getAxiosMocker().onPost().reply(500);

    await HttpSpansAgent.postSpans(reqBody);

    //no Error thrown
  });

  test('postSpans - reject network error', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });

    AxiosMocker.getAxiosMocker().onPost().networkError();

    await HttpSpansAgent.postSpans(reqBody);

    //no Error thrown
  });

  test('postSpans - reject timeout', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });

    AxiosMocker.getAxiosMocker().onPost().timeout();

    await HttpSpansAgent.postSpans(reqBody);

    //no Error thrown
  });

  const testTimeout = 700; //in MS
  test(
    'postSpans - reject connection timeout',
    async () => {
      let called = false;
      const reqBody = 'abcdefg';
      globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });

      jest.spyOn(axios, 'create').mockImplementationOnce(() => {
        return {
          post: async () => {
            called = true;
            await sleep(testTimeout + 500);
          },
        };
      });

      await HttpSpansAgent.postSpans(reqBody);
      expect(called).toBe(true);
    },
    testTimeout
  );
});
