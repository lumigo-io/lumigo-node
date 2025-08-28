/* eslint-disable */
import { encode } from 'utf8';
import { AxiosMocker } from '../testUtils/axiosMocker';
import { ConsoleWritesForTesting } from '../testUtils/consoleMocker';
import { SpansContainer, TracerGlobals } from './globals';
import * as reporter from './reporter';
import { scrubSpans, sendSpans } from './reporter';
import * as utils from './utils';
import { getEventEntitySize, getJSONBase64Size, setDebug } from './utils';
import { ENRICHMENT_SPAN, FUNCTION_SPAN, getSpanMetadata, HTTP_SPAN } from './spans/awsSpan';
import { unzipSync } from 'zlib';
import { splitSpansByType } from '../testUtils/spansUtils';

const exampleEnrichmentSpan = {
  droppedSpansReasons: {
    SPANS_SENT_SIZE_LIMIT: {
      drops: 1,
    },
  },
  id: 'a613dc29-4880-2ed4-a481-e3fc191a895d',
  lumigo_execution_tags_no_scrub: [],
  sending_time: 1721553810449,
  totalSpans: 1,
  transaction_id: '64a1b06067c2100c52e51ef4',
  type: 'enrichment',
};

describe('reporter', () => {
  test('sendSingleSpan', async () => {
    const token = 'DEADBEEF';
    utils.setDebug();
    TracerGlobals.setTracerInputs({ token });
    const span = { a: 'b', c: 'd' };

    await reporter.sendSingleSpan(span);

    const spans = AxiosMocker.getSentSpans();
    expect(spans.length).toEqual(1);
    expect(spans[0].length).toEqual(1);
    expect(spans[0][0]).toEqual(span);
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
    const endSpan = { id: 'func-span', e: 'f', g: 'h', type: FUNCTION_SPAN };
    TracerGlobals.setTracerInputs({
      maxSizeForRequest: 500,
    });
    const span1 = {
      id: 'span1',
      keyWithData: 'valueWithData',
      anotherKeyWithData: 'anotherValueWithData',
    };
    const span2 = { id: 'span2', e: 'f', g: 'h', type: FUNCTION_SPAN };

    const expectedFunctionSpans = [
      JSON.parse(JSON.stringify(endSpan)),
      JSON.parse(JSON.stringify(span2)),
    ];

    SpansContainer.addSpan(endSpan, true);
    SpansContainer.addSpan(span1);
    SpansContainer.addSpan(span2);

    const spans = [endSpan, span1, span2];
    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans.length).toEqual(1);
    const spansByType = splitSpansByType(sentSpans[0]);
    expect(Object.keys(spansByType)).toEqual(['function', 'enrichment']);
    expect(spansByType.function).toEqual(expectedFunctionSpans);
    expect(spansByType.enrichment.length).toEqual(1);
    const enrichmentSpan = spansByType.enrichment[0];
    expect(enrichmentSpan).toMatchObject({
      type: 'enrichment',
      // 3 spans specified in the test + the enrichment span
      totalSpans: 4,
      droppedSpansReasons: {
        SPANS_SENT_SIZE_LIMIT: {
          drops: 1,
        },
      },
      lumigo_execution_tags_no_scrub: [],
    });
    // expect(sentSpans).toEqual([expectedSpans]);
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

  test(`forgeAndScrubRequestBody - use requestSizeOnError when having error span`, async () => {
    const end = {
      id: 'idend',
      end: 'dummyEnd',
      type: FUNCTION_SPAN,
      envs: { firstEnvKey: 'First environment variable value' },
    };
    const error = {
      id: 'iderror',
      dummy: 'dummy',
      type: HTTP_SPAN,
      error: 'error',
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              body: 'no response because we have an error',
            }),
          },
        },
      },
    };

    const spans = [end, error];
    const size = getJSONBase64Size([end, error, exampleEnrichmentSpan]);
    TracerGlobals.setTracerInputs({
      maxSizeForRequest: size - 30,
      maxSizeForRequestOnError: size,
    });

    SpansContainer.addSpan(end);
    SpansContainer.addSpan(error);
    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans.length).toEqual(1);
    const spansByType = splitSpansByType(sentSpans[0]);
    expect(Object.keys(spansByType)).toEqual([FUNCTION_SPAN, HTTP_SPAN, ENRICHMENT_SPAN]);
    expect(spansByType[FUNCTION_SPAN]).toEqual([end]);
    expect(spansByType[HTTP_SPAN]).toEqual([error]);
    expect(spansByType[ENRICHMENT_SPAN].length).toEqual(1);
    expect(spansByType[ENRICHMENT_SPAN][0]).toMatchObject({
      droppedSpansReasons: {},
      lumigo_execution_tags_no_scrub: [],
      totalSpans: 3,
      type: ENRICHMENT_SPAN,
    });
  });

  test(`forgeAndScrubRequestBody - don't use requestSizeOnError when all spans succeed`, async () => {
    const end = {
      id: 'idend',
      end: 'dummyEnd',
      type: FUNCTION_SPAN,
      envs: { firstEnvKey: 'First environment variable value' },
    };
    const dummy = {
      dummy: 'dummy',
      type: HTTP_SPAN,
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              body: 'no response because we have an error',
            }),
          },
        },
      },
    };
    const dummy1 = {
      id: 'id1',
      ...dummy,
    };
    const dummy2 = {
      id: 'id2',
      ...dummy,
    };
    const spans = [dummy1, dummy2, end];
    const size = getJSONBase64Size([end, dummy1, { ...exampleEnrichmentSpan, isMetadata: true }]);
    TracerGlobals.setTracerInputs({
      maxSizeForRequest: size,
      maxSizeForRequestOnError: size * 2,
    });

    SpansContainer.addSpan(end);
    SpansContainer.addSpan(dummy1);
    SpansContainer.addSpan(dummy2);
    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans.length).toEqual(1);
    const spansByType = splitSpansByType(sentSpans[0]);
    expect(Object.keys(spansByType)).toEqual([FUNCTION_SPAN, ENRICHMENT_SPAN, HTTP_SPAN]);
    expect(spansByType[FUNCTION_SPAN]).toEqual([end]);
    expect(spansByType[HTTP_SPAN]).toEqual([getSpanMetadata(dummy1), getSpanMetadata(dummy2)]);
    expect(spansByType[ENRICHMENT_SPAN].length).toEqual(1);
  });

  test(`forgeAndScrubRequestBody - with smart prioritization only metadata`, async () => {
    const dummy = {
      dummy: 'dummy',
      type: HTTP_SPAN,
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              body: 'aaaaaaaa',
            }),
          },
          response: {
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              longBodyKey: 'body with very long value that we think we need to cut in the middle',
            }),
          },
        },
      },
    };
    const end = {
      end: 'dummyEnd',
      type: FUNCTION_SPAN,
      envs: {
        firstEnvKey: 'First environment variable value',
        secondEnvKey: 'Second environment variable value',
        thirdEnvKey: 'Third environment variable value',
      },
    };
    const error = {
      dummy: 'dummy',
      type: HTTP_SPAN,
      error: 'error',
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              body: 'no response because we have an error',
            }),
          },
        },
      },
    };
    const dummyMetadata = getSpanMetadata(dummy);
    const errorMetadata = getSpanMetadata(error);
    const endMetadata = getSpanMetadata(end);

    const spans = [dummy, error, end];
    const expectedSpans = [endMetadata, errorMetadata, dummyMetadata];
    const size = getJSONBase64Size(expectedSpans.concat([exampleEnrichmentSpan])) + 10;
    TracerGlobals.setTracerInputs({
      maxSizeForRequest: size,
      maxSizeForRequestOnError: size,
    });

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans.length).toEqual(1);
    const spansByType = splitSpansByType(sentSpans[0]);
    expect(Object.keys(spansByType)).toEqual([FUNCTION_SPAN, ENRICHMENT_SPAN, HTTP_SPAN]);
    expect(spansByType[FUNCTION_SPAN]).toEqual([endMetadata]);
    expect(spansByType[HTTP_SPAN]).toEqual([errorMetadata, dummyMetadata]);
    expect(spansByType[ENRICHMENT_SPAN].length).toEqual(1);
  });

  test(`sendSpans - with smart prioritization with partial full spans`, async () => {
    const dummy = {
      dummy: 'dummy',
      type: HTTP_SPAN,
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              body: 'aaaaaaaa',
            }),
          },
          response: {
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              longBodyKey: 'body with very long value that we think we need to cut in the middle',
            }),
          },
        },
      },
    };
    const end = {
      end: 'dummyEnd',
      type: FUNCTION_SPAN,
      envs: { firstEnvKey: 'First environment variable value' },
    };
    const error = {
      dummy: 'dummy',
      type: HTTP_SPAN,
      error: 'error',
      info: {
        httpInfo: {
          host: 'your.mind.com',
          request: {
            host: 'your.mind.com',
            headers: {
              'content-type': 'json',
            },
            body: JSON.stringify({
              body: 'no response because we have an error',
            }),
          },
        },
      },
    };
    const dummyMetadata = getSpanMetadata(dummy);

    const spans = [dummy, error, end];
    const expectedSpans = [end, error, dummyMetadata];
    const size = getJSONBase64Size(expectedSpans.concat([exampleEnrichmentSpan]));
    TracerGlobals.setTracerInputs({ maxSizeForRequest: size, maxSizeForRequestOnError: size });

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans.length).toEqual(1);
    const spansByType = splitSpansByType(sentSpans[0]);
    expect(Object.keys(spansByType)).toEqual([FUNCTION_SPAN, ENRICHMENT_SPAN, HTTP_SPAN]);
    expect(spansByType[FUNCTION_SPAN]).toEqual([end]);
    expect(spansByType[HTTP_SPAN]).toEqual([error, dummyMetadata]);
    expect(spansByType[ENRICHMENT_SPAN].length).toEqual(1);
  });

  test('forgeRequestBody - simple flow', async () => {
    const dummy = { dummy: 'dummy', type: HTTP_SPAN };
    const dummyEnd = { dummy: 'dummyEnd', type: FUNCTION_SPAN };
    const spans = [
      JSON.parse(JSON.stringify(dummy)),
      JSON.parse(JSON.stringify(dummy)),
      JSON.parse(JSON.stringify(dummyEnd)),
    ];

    const expectedResult = [dummyEnd, dummy];
    const expectedResultSize = getJSONBase64Size([dummyEnd, dummy]);

    expect(
      reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)
    ).toEqual(JSON.stringify(expectedResult));
  });

  describe('forgeAndScrubRequestBody parsing tests', () => {
    test('forgeAndScrubRequestBody - scrub secrets', async () => {
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
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        // @ts-ignore
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expectedResult);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody scrub domain', () => {
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
                body: 'The data is not available',
                host: 'your.mind.com',
              },
              response: {
                body: 'The data is not available',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));
      process.env.LUMIGO_DOMAINS_SCRUBBER = '["mind"]';
      const actual = JSON.parse(
        // @ts-ignore
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });
    test('forgeAndScrubRequestBody', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          truncated: false,
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
          truncated: false,
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
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody truncated response', () => {
      const value = 'a'.repeat(10);
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                truncated: false,
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: '{"secret": "secret"}',
              },
              response: {
                truncated: true,
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: `{"a":"${value}","b":"${value}","key":"${value}","password":"${value}","e":"${value}","secret":"${value}","f":"${value}","g":"${value}","h":`,
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
                truncated: false,
                body: '{"secret":"****"}',
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                truncated: true,
                body: `{"a":"${value}","b":"${value}","key":"****","password":"****","e":"${value}","secret":"****","f":"${value}","g":"${value}"}...[too long]`,
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody long response', () => {
      const value = 'a'.repeat(10);
      const long = 'a'.repeat(getEventEntitySize(true));
      const shorter = 'a'.repeat(getEventEntitySize());
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                truncated: false,
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: '{"secret": "secret"}',
              },
              response: {
                truncated: false,
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: `{"key":"${value}","password":"${value}","e":"${value}","secret":"${value}","f":"${value}","g":"${value}","h":"${long}"}`,
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
                truncated: false,
                body: '{"secret":"****"}',
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                truncated: false,
                body: `{"key":"****","password":"****","e":"${value}","secret":"****","f":"${value}","g":"${value}","h":"${shorter}"}...[too long]`,
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody truncated request', () => {
      const value = 'a'.repeat(10);
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                truncated: true,
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: `{"key":"${value}","password":"${value}","e":"${value}","secret":"${value}","f":"${value}","g":"${value}","h":`,
              },
              response: {
                truncated: false,
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: '{"secret": "secret"}',
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
                truncated: true,
                body: `{"key":"****","password":"****","e":"${value}","secret":"****","f":"${value}","g":"${value}"}...[too long]`,
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                truncated: false,
                body: '{"secret":"****"}',
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody long request', () => {
      const value = 'a'.repeat(10);
      const long = 'a'.repeat(getEventEntitySize(true));
      const shorter = 'a'.repeat(getEventEntitySize());
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                truncated: false,
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: `{"key":"${value}","password":"${value}","e":"${value}","secret":"${value}","f":"${value}","g":"${value}","h":"${long}"}`,
              },
              response: {
                truncated: false,
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: '{"secret": "secret"}',
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
                truncated: false,
                body: `{"key":"****","password":"****","e":"${value}","secret":"****","f":"${value}","g":"${value}","h":"${shorter}"}...[too long]`,
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                truncated: false,
                body: '{"secret":"****"}',
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });
    test('forgeAndScrubRequestBody short response', () => {
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
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody => decode utf-8', () => {
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
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody contain json header but not json body', () => {
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
      const expectedResultSize = getJSONBase64Size(spans.concat([exampleEnrichmentSpan]));

      const actual = JSON.parse(
        reporter.forgeAndScrubRequestBody(spans, expectedResultSize, expectedResultSize)!
      );
      const actualNonEnrichment = actual.filter((span) => span.type !== ENRICHMENT_SPAN);
      const actualEnrichment = actual.filter((span) => span.type === ENRICHMENT_SPAN);
      expect(actualNonEnrichment).toEqual(expected);
      expect(actualEnrichment.length).toEqual(1);
    });

    test('forgeAndScrubRequestBody - response with error should double payload size', () => {
      const sendTime = 1234;
      const receivedTime = 1256;
      const longString = 'a'.repeat(getEventEntitySize() * 2);

      const dummyEnd = 'dummyEnd';
      const spansSuccess = [
        {
          truncated: false,
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { longString },
                body: longString,
                sendTime,
              },
              response: {
                headers: { longString },
                body: longString,
                statusCode: 200,
                receivedTime,
              },
            },
          },
        },
        { dummyEnd },
      ];
      const spansFail = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { longString },
                body: longString,
                sendTime,
              },
              response: {
                headers: { longString },
                body: longString,
                statusCode: 404,
                receivedTime,
              },
            },
          },
        },
        { dummyEnd },
      ];

      const expectedResultSizeSuccess = getJSONBase64Size(
        spansSuccess.concat([exampleEnrichmentSpan])
      );
      const expectedResultSizeFail = getJSONBase64Size(spansFail.concat([exampleEnrichmentSpan]));

      const spanSuccess = JSON.parse(
        reporter.forgeAndScrubRequestBody(
          spansSuccess,
          expectedResultSizeSuccess,
          expectedResultSizeSuccess
        )!
      )[0];
      const spanError = JSON.parse(
        reporter.forgeAndScrubRequestBody(
          spansFail,
          expectedResultSizeFail,
          expectedResultSizeFail
        )!
      )[0];
      expect(spanError.info.httpInfo.request.body.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.request.body.length * 1.8 + 1
      );
      expect(spanError.info.httpInfo.request.headers.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.request.headers.length * 1.8 + 1
      );
      expect(spanError.info.httpInfo.response.body.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.response.body.length * 1.8 + 1
      );
      expect(spanError.info.httpInfo.response.headers.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.response.headers.length * 1.8 + 1
      );
    });
  });

  test('forgeRequestBody - cut spans', async () => {
    const dummy = { dummy: 'dummy', type: HTTP_SPAN };
    const end = { end: 'dummyEnd', type: FUNCTION_SPAN };
    const error = { dummy: 'dummy', type: HTTP_SPAN, error: 'error' };

    const spans = [dummy, error, end];
    const expectedResult = [JSON.parse(JSON.stringify(end)), JSON.parse(JSON.stringify(error))];
    const maxSendBytes = getJSONBase64Size([
      JSON.parse(JSON.stringify(end)),
      JSON.parse(JSON.stringify(error)),
    ]);

    expect(reporter.forgeAndScrubRequestBody(spans, maxSendBytes, maxSendBytes)).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  test('forgeRequestBody - cut spans - skip initiate stringify (performance boost)', async () => {
    const dummy = { dummy: 'dummy' };
    const spans = new Array(reporter.NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION + 1).fill({ dummy });

    const spy = jest.spyOn(utils, 'getJSONBase64Size');

    expect(spy).not.toBeCalled();
  });

  test('forgeRequestBody - prune trace off not cutting spans', async () => {
    utils.setPruneTraceOff();
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';

    const dummySpan = {
      id: 'id1',
      type: HTTP_SPAN,
      dummy,
    };
    const errorSpan = {
      id: 'id2',
      type: HTTP_SPAN,
      dummy,
      error,
    };
    const endSpan = {
      id: 'id3',
      type: FUNCTION_SPAN,
      dummyEnd,
    };
    const spans = [dummySpan, errorSpan, endSpan];

    // @ts-ignore
    const sentSpans = JSON.parse(reporter.forgeAndScrubRequestBody(spans, 600, 600));
    const spansByType = splitSpansByType(sentSpans);
    expect(Object.keys(spansByType)).toEqual([HTTP_SPAN, FUNCTION_SPAN, ENRICHMENT_SPAN]);
    expect(spansByType[FUNCTION_SPAN]).toEqual([endSpan]);
    expect(spansByType[HTTP_SPAN]).toEqual([dummySpan, errorSpan]);
    expect(spansByType[ENRICHMENT_SPAN].length).toEqual(1);

    // .toEqual(JSON.stringify(spans));
    expect(reporter.forgeAndScrubRequestBody([], 100, 100)).toEqual(undefined);
  });

  test('forgeRequestBody - empty list', async () => {
    expect(reporter.forgeAndScrubRequestBody([], 100, 100)).toEqual(undefined);
  });

  test('scrubSpans missing http fields', () => {
    const spans = [
      {
        // span without request and response bodies and headers
        info: {
          httpInfo: {
            host: 'host',
            request: {},
            response: {},
          },
        },
      },
      {
        // missing request and response and host
        info: {
          httpInfo: {},
        },
      },
      { info: {} }, // missing httpInfo
      {}, // missing info
      {
        // missing headers in request and body in response
        info: {
          httpInfo: {
            host: 'host',
            request: {
              body: '',
            },
            response: {
              headers: {},
            },
          },
        },
      },
      {
        // missing host
        info: {
          httpInfo: {
            request: {
              body: '',
              headers: {},
            },
            response: {
              body: '',
              headers: {},
            },
          },
        },
      },
    ];
    scrubSpans(spans);
    expect(spans.length).toEqual(spans.length);
  });

  test('scrubSpans missing http fields (stepFunction)', () => {
    const spans = [
      {
        info: {
          traceId: {
            Root: 'Root',
            Parent: 'Parent',
            Sampled: '0',
            transactionId: 'transactionId',
          },
          httpInfo: { host: 'StepFunction' },
          resourceName: 'StepFunction',
          messageId: 'messageId',
        },
      },
    ];
    const resultSpans = [...spans];
    scrubSpans(spans);
    expect(spans).toEqual(resultSpans);
  });

  test('scrubSpans should not fail after throwing an error', () => {
    const shouldScrubDomainMock = jest
      .spyOn(utils, 'spanHasErrors')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        throw new Error('Error');
      });
    const spanWithoutSecrets = {
      id: '2',
      info: { httpInfo: { request: {}, response: { body: 'body' } } },
    };
    const beforeScrub = [
      {
        id: '1',
        info: {
          httpInfo: {
            request: { host: 'StepFunction' },
            response: {
              headers: { 'content-type': 'json' },
              body: JSON.stringify({ secret: '1234' }),
            },
          },
        },
      },
      spanWithoutSecrets,
      {
        id: '3',
        info: {
          httpInfo: {
            request: {},
            response: {
              headers: { 'content-type': 'json' },
              body: JSON.stringify({ secret: '1234' }),
            },
          },
        },
      },
    ];
    const scrubbed = [
      {
        id: '1',
        info: {
          httpInfo: {
            request: {
              host: 'StepFunction',
            },
            response: {
              headers: '{"content-type":"json"}',
              body: '{"secret":"****"}',
            },
          },
        },
      },
      spanWithoutSecrets,
    ];
    expect(scrubSpans(beforeScrub)).toEqual(scrubbed);
    shouldScrubDomainMock.mockReset();
  });

  test('scrubSpans should scrub without content-type', () => {
    const spanWithoutSecrets = {
      id: '1',
      info: { httpInfo: { request: {}, response: { body: 'body' } } },
    };
    const beforeScrub = [
      spanWithoutSecrets,
      {
        id: '2',
        info: {
          httpInfo: {
            request: {
              headers: {},
              body: JSON.stringify({ secret: '1234' }),
            },
            response: {},
          },
        },
      },
      {
        id: '3',
        info: {
          httpInfo: {
            request: {},
            response: {
              headers: { 'content-type': 'json' },
              body: JSON.stringify({ secret: '1234' }),
            },
          },
        },
      },
      {
        id: '4',
        info: {
          httpInfo: {
            request: {
              headers: {},
              body: '{"secret":""...}',
            },
            response: {},
          },
        },
      },
    ];
    const scrubbed = [
      spanWithoutSecrets,
      {
        id: '2',
        info: {
          httpInfo: {
            request: {
              headers: '{}',
              body: '{"secret":"****"}',
            },
            response: {},
          },
        },
      },
      {
        id: '3',
        info: {
          httpInfo: {
            request: {},
            response: {
              headers: '{"content-type":"json"}',
              body: '{"secret":"****"}',
            },
          },
        },
      },
      {
        id: '4',
        info: {
          httpInfo: {
            request: {
              headers: '{}',
              body: '"{\\"secret\\":\\"\\"...}"',
            },
            response: {},
          },
        },
      },
    ];
    expect(scrubSpans(beforeScrub)).toEqual(scrubbed);
  });

  test(`sendSpans -> handle errors in forgeAndScrubRequestBody`, async () => {
    setDebug();
    // @ts-ignore
    await sendSpans({});
    //Test that no error is raised

    const logs = ConsoleWritesForTesting.getLogs();
    expect(logs.length).toEqual(2);
    expect(logs[0].msg).toEqual('#LUMIGO# - WARNING - "Error in Lumigo tracer"');
    expect(logs[1].msg).toEqual('#LUMIGO# - WARNING - "Error in Lumigo tracer"');
    expect(JSON.parse(logs[0].obj).message).toEqual('spans.some is not a function');
    expect(JSON.parse(logs[1].obj).message).toEqual('spans.map is not a function');
    expect(JSON.parse(logs[0].obj).stack).toBeTruthy();
    expect(JSON.parse(logs[1].obj).stack).toBeTruthy();
  });

  test('sending a huge payload, bigger than the regular limit, zipping and getting is back completely', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    const span = {
      id: 'aacf6530-cade-774b-84a5-3c95e58009d2',
      info: {
        traceId: {
          Root: '1-66350ad2-17e1c33628691ff954d510dd',
          Parent: '7c500ef2404493cf',
          Sampled: '0',
          Lineage: '04b9c687:0',
          transactionId: '17e1c33628691ff954d510dd',
        },
        tracer: {
          name: '@lumigo/tracer',
          version: '1.91.0',
        },
        logGroupName: '/aws/lambda/testing-nodejs-lambda-multiple-spans',
        logStreamName: '2024/05/03/[$LATEST]2b5d907384984bcd8c81a505acc40f06',
        httpInfo: {
          host: 'restcountries.com',
          request: {
            truncated: false,
            path: '/v3.1/name/eesti',
            port: '',
            uri: 'restcountries.com/v3.1/name/eesti',
            host: 'restcountries.com',
            body: '',
            method: 'GET',
            headers: {
              traceparent: '00-17e1c33628691ff954d510dd00000000-399cda8a2fadf29e-01',
              tracestate: 'lumigo=399cda8a2fadf29e',
              host: 'restcountries.com',
            },
            protocol: 'https:',
            sendTime: 1714752221056,
          },
          response: {
            truncated: false,
          },
        },
        messageId: '399cda8a2fadf29e',
      },
      vendor: 'AWS',
      transactionId: '17e1c33628691ff954d510dd',
      account: '654654327014',
      memoryAllocated: '128',
      version: '$LATEST',
      runtime: 'AWS_Lambda_nodejs18.x',
      readiness: 'warm',
      messageVersion: 2,
      token: 't_c0e660dae2b84a739c361',
      region: 'us-west-2',
      invokedArn:
        'arn:aws:lambda:us-west-2:654654327014:function:testing-nodejs-lambda-multiple-spans',
      invokedVersion: '$LATEST',
      type: 'http',
      parentId: '4c831d94-f597-45ca-9ab8-8c123c9a5595',
      reporterAwsRequestId: '4c831d94-f597-45ca-9ab8-8c123c9a5595',
      service: 'external',
      started: 1714752221056,
    };

    // create a big array of spans which is definitely bigger than the limit
    const bigSpans = new Array(reporter.NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION * 2).fill(span);

    // set env var to make sure we are zipping
    process.env.LUMIGO_SUPPORT_LARGE_INVOCATIONS = 'TRUE';

    await reporter.sendSpans(bigSpans);
    const sentSpansZipped: any[] = AxiosMocker.getSentSpans();

    //Unzip all payloads and compare them to the original spans
    const unzippedSpans: any[] = sentSpansZipped.flatMap((span) => {
      const unzipped = unzipSync(Buffer.from(span, 'base64')).toString();
      return JSON.parse(unzipped);
    });

    // order is not important
    expect(unzippedSpans.sort()).toEqual(bigSpans.sort());
  });

  test('sending a small payload while turning the zip flag on and making sure it is not zipped', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    const span = {
      id: 'aacf6530-cade-774b-84a5-3c95e58009d2',
    };

    // Turn on the zip flag, even though the payload is small and should not go to the zip part
    process.env.LUMIGO_SUPPORT_LARGE_INVOCATIONS = 'TRUE';
    const spans = [span];

    await reporter.sendSpans(spans);
    const sentSpans = AxiosMocker.getSentSpans();

    expect(sentSpans).toEqual([spans]);
  });

  test('splitAndZipSpans -> verify it splits to bulks successfully', () => {
    const spans = new Array(reporter.NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION * 2).fill({});

    const splitSpans = reporter.splitAndZipSpans(spans);
    expect(splitSpans.length).toEqual(
      (reporter.NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION * 2) / reporter.MAX_SPANS_BULK_SIZE
    );

    // test unzipping
    const unzippedSpans = splitSpans.flatMap((span) => {
      const unzipped = unzipSync(Buffer.from(span, 'base64')).toString();
      return JSON.parse(unzipped);
    });
    expect(unzippedSpans).toEqual(spans);
  });
});
