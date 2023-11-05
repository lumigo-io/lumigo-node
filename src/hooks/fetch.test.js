import { mockFetchGlobal } from '../../testUtils/fetchMocker';
import { FetchSpanBuilder } from '../../testUtils/fetchSpanBuilder';
import { HandlerInputsBuilder } from '../../testUtils/handlerInputsBuilder';
import { SpansContainer, TracerGlobals } from '../globals';
import { payloadStringify } from '../utils/payloadStringify';
import { hookFetch } from './fetch';

const TEST_URL = 'https://www.google.com';

describe('fetch', () => {
  beforeEach(() => {
    const handlerInputs = new HandlerInputsBuilder().build();
    TracerGlobals.setHandlerInputs(handlerInputs);
  });

  test('hook fetch -> simple flow', async () => {
    const textString = 'hello world';
    mockFetchGlobal({
      status: 200,
      body: textString,
    });
    hookFetch();

    const response = await fetch(TEST_URL);
    expect(response.ok).toEqual(true);
    expect(await response.text()).toEqual(textString);

    const spans = SpansContainer.getSpans();
    const expectedSpan = new FetchSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withUrl(TEST_URL)
      .withOptions({})
      .withStatusCode(200)
      .withResponse(payloadStringify(textString))
      .build();
    expect(spans).toEqual([expectedSpan]);
  });

  test('hook fetch -> not found', async () => {
    mockFetchGlobal({
      status: 404,
      statusText: 'Not found.',
    });
    hookFetch();

    const response = await fetch(TEST_URL);
    expect(response.ok).toEqual(false);
    expect(response.text()).resolves.toEqual('Not found.');

    const spans = SpansContainer.getSpans();
    const expectedSpan = new FetchSpanBuilder()
      .withId(spans[0].id)
      .withStarted(spans[0].started)
      .withEnded(spans[0].ended)
      .withUrl(TEST_URL)
      .withOptions({})
      .withStatusCode(404)
      .withError('Not found.')
      .build();
    expect(spans).toEqual([expectedSpan]);
  });
});
