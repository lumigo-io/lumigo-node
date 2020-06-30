import { AxiosMocker } from '../testUtils/axiosMocker';
import * as utils from './utils';
import { HttpSpansAgent } from './httpSpansAgent';
import * as globals from './globals';

describe('HttpSpansAgent', () => {
  test('postSpans - simple flow', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });
    const { url } = utils.getEdgeUrl();

    await HttpSpansAgent.postSpans(reqBody);

    const requests = AxiosMocker.getAxiosMocker().history.post;
    expect(requests.length).toEqual(1);
    expect(requests[0].data).toEqual(reqBody);
    expect(requests[0].headers).toEqual({
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 't_xxx',
      'User-Agent': '@lumigo/tracerMock$1.2.3',
    });
    expect(requests[0].timeout).toEqual(250);
    expect(requests[0].baseURL).toEqual(url);
  });

  test('postSpans - reject 500', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });

    AxiosMocker.getAxiosMocker()
      .onPost()
      .reply(500);

    await HttpSpansAgent.postSpans(reqBody);

    //no Error throwed
  });

  test('postSpans - reject network error', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });

    AxiosMocker.getAxiosMocker()
      .onPost()
      .networkError();

    await HttpSpansAgent.postSpans(reqBody);

    //no Error throwed
  });

  test('postSpans - reject timout', async () => {
    const reqBody = 'abcdefg';
    globals.TracerGlobals.setTracerInputs({ token: 't_xxx' });

    AxiosMocker.getAxiosMocker()
      .onPost()
      .timeout();

    await HttpSpansAgent.postSpans(reqBody);

    //no Error throwed
  });
});
