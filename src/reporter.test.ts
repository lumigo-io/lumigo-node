/* eslint-disable */
import { TracerGlobals } from './globals';
import * as reporter from './reporter';
import * as utils from './utils';
import { AxiosMocker } from '../testUtils/axiosMocker';
import { getEventEntitySize, getJSONBase64Size } from './utils';
import * as awsSpan from './spans/awsSpan';
import { encode } from 'utf8';

describe('reporter', () => {
  test('sendSingleSpan', async () => {
    const token = 'DEADBEEF';
    utils.setDebug();
    TracerGlobals.setTracerInputs({ token });
    const span = { a: 'b', c: 'd' };

    await reporter.sendSingleSpan(span);

    const spans = AxiosMocker.getSentSpans();
    expect(spans).toEqual([[span]]);
  });

  test('isSpansContainsErrors', async () => {
    const genReturnValue = (statusCode) => ({
      returnValue: {
        statusCode,
      },
    });
    const dummy = { dummy: 'dummy' };
    const error = { error: 'error' };
    const spansWithStatusCode = [dummy, genReturnValue(200), dummy];
    const spansWithErrorStatusCode = [dummy, genReturnValue(500), dummy];
    const spansWithError = [dummy, error, dummy];
    const spansWithoutError = [dummy, dummy];

    const assertSpans = (spans, result) =>
      expect(reporter.isSpansContainsErrors(spans)).toEqual(result);

    assertSpans(spansWithStatusCode, false);
    assertSpans(spansWithErrorStatusCode, true);
    assertSpans(spansWithError, true);
    assertSpans(spansWithoutError, false);
  });

  test('sendSpans - use tracerInputs', async () => {
    TracerGlobals.setTracerInputs({ maxSizeForRequest: 10 });
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([[{ e: 'f', g: 'h' }]]);
  });

  test('sendSpans - simple flow', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
  });

  test('sendSpans - send only on errors without errors', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    utils.setSendOnlyIfErrors();
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([]);
  });

  test('sendSpans - send only on errors with errors', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    utils.setSendOnlyIfErrors();
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h', error: 'error' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
  });

  test('sendSpans - with bad LUMIGO_SECRET_MASKING_REGEX still send spans', async () => {
    const token = 'DEADBEEF';
    process.env.LUMIGO_SECRET_MASKING_REGEX = 'NON-VALID-JSON';
    TracerGlobals.setTracerInputs({ token });

    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h', error: 'error' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
  });

  test('forgeRequestBody - simple flow', async () => {
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const spans = [{ dummy }, { dummy }, { dummyEnd }];

    const expectedResult = [{ dummy }, { dummyEnd }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeAndScrubRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  describe('http parsing tests', () => {
    test('forgeRequestBody - scrub secrets', async () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              request: {
                headers: {
                  'content-type': 'json',
                },
                body: JSON.stringify({
                  secret: 'aaaaaaaa',
                }),
              },
              response: {
                headers: {
                  'content-type': 'json',
                },
                body: JSON.stringify({
                  secret: 'aaaaaaaa',
                }),
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResult = [
        {
          info: {
            httpInfo: {
              request: {
                headers: JSON.stringify({
                  'content-type': 'json',
                }),
                body: JSON.stringify({
                  secret: '****',
                }),
              },
              response: {
                headers: JSON.stringify({
                  'content-type': 'json',
                }),
                body: JSON.stringify({
                  secret: '****',
                }),
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = reporter.forgeAndScrubRequestBody(spans, expectedResultSize);
      expect(actual).toEqual(JSON.stringify(expectedResult));
    });
    test('getHttpInfo', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                headers: { Tyler: 'Durden', secretKey: 'lumigo' },
                body: 'the first rule of fight club',
              },
              response: {
                headers: { Peter: 'Parker' },
                body: 'Well, Tony is dead.',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"the first rule of fight club"',
                headers: '{"Tyler":"Durden","secretKey":"****"}',
              },
              response: {
                body: '"Well, Tony is dead."',
                headers: '{"Peter":"Parker"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('getHttpInfo long response', () => {
      let manyA = 'a'.repeat(88);
      let manyManyA = 'a'.repeat(1268);
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: '{"secret": "secret"}',
              },
              response: {
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: `{"a":"${manyA}","b":"${manyA}","key":"${manyA}","password":"${manyA}","e":"${manyA}","secret":"${manyA}","f":"${manyA}","g":"${manyA}","h":"${manyManyA}"`,
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '{"secret":"****"}',
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                body: `{"a":"${manyA}","b":"${manyA}","key":"****","password":"****","e":"${manyA}","secret":"****","f":"${manyA}","g":"${manyA}","h":"${manyManyA}"}`,
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('getHttpInfo short response', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { Tyler: 'Durden', secretKey: 'lumigo' },
                body: 'the first rule of fight club',
              },
              response: {
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: '{"secret": "abcd"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"the first rule of fight club"',
                headers: '{"Tyler":"Durden","secretKey":"****"}',
                host: 'your.mind.com',
              },
              response: {
                body: '{"secret":"****"}',
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('getHttpInfo => decode utf-8', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { Tyler: 'Durden', secretKey: 'lumigo' },
                body: 'the first rule of fight club',
              },
              response: {
                headers: { Peter: 'Parker' },
                body: encode('Well, Tony is dead.'),
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"the first rule of fight club"',
                headers: '{"Tyler":"Durden","secretKey":"****"}',
                host: 'your.mind.com',
              },
              response: {
                body: '"Well, Tony is dead."',
                headers: '{"Peter":"Parker"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('getHttpInfo contain json header but not json body', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: 'Scotty doesnt know secret...',
              },
              response: {
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: 'That Fiona and me... password',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"Scotty doesnt know secret..."',
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                body: '"That Fiona and me... password"',
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });
  });

  test('forgeRequestBody - cut spans', async () => {
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';

    const spans = [{ dummy }, { dummy, error }, { dummyEnd }];
    const expectedResult = [{ dummy, error }, { dummyEnd }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeAndScrubRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  test('forgeRequestBody - cut spans - skip initiate stringify (performance boost)', async () => {
    const dummy = { dummy: 'dummy' };
    const spans = new Array(reporter.NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION + 1).fill({ dummy });

    const spy = jest.spyOn(utils, 'getJSONBase64Size');

    expect(reporter.shouldTrim(spans, 1)).toEqual(true);
    expect(spy).not.toBeCalled();
  });

  test('forgeRequestBody - prune trace off not cutting spans', async () => {
    utils.setPruneTraceOff();
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';
    const spans = [{ dummy }, { dummy, error }, { dummyEnd }];

    expect(reporter.forgeAndScrubRequestBody(spans, 100)).toEqual(JSON.stringify(spans));
    expect(reporter.forgeAndScrubRequestBody([], 100)).toEqual(undefined);
  });

  test('forgeRequestBody - empty list', async () => {
    expect(reporter.forgeAndScrubRequestBody([], 100)).toEqual(undefined);
  });
});
