/* eslint-disable */
import { TracerGlobals } from './globals';
import * as reporter from './reporter';
import * as utils from './utils';
import { AxiosMocker } from '../testUtils/axiosMocker';
import { getJSONBase64Size } from './utils';

describe('reporter', () => {
  test('sendSingleSpan', async () => {
    const token = 'DEADBEEF';
    utils.setDebug();
    TracerGlobals.setTracerInputs({ token });
    const span = { a: 'b', c: 'd' };

    const result = await reporter.sendSingleSpan(span);

    const spans = AxiosMocker.getSentSpans();
    expect(spans).toEqual([[span]]);

    expect(result.rtt).toBeGreaterThanOrEqual(0);
  });

  test('isSpansContainsErrors', async () => {
    const genReturnValue = statusCode => ({
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

  test('sendSpans - simple flow', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    const spans = [{ a: 'b', c: 'd' }, { e: 'f', g: 'h' }];

    const result = await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);

    expect(result.rtt).toBeGreaterThanOrEqual(0);
  });

  test('sendSpans - send only on errors without errors', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    utils.setSendOnlyIfErrors();
    const spans = [{ a: 'b', c: 'd' }, { e: 'f', g: 'h' }];

    const result = await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([]);

    expect(result.rtt).toEqual(0);
  });

  test('sendSpans - send only on errors with errors', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    utils.setSendOnlyIfErrors();
    const spans = [{ a: 'b', c: 'd' }, { e: 'f', g: 'h', error: 'error' }];

    const result = await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
    expect(result.rtt).toBeGreaterThanOrEqual(0);
  });

  test('sendSpans - with bad LUMIGO_SECRET_MASKING_REGEX still send spans', async () => {
    const token = 'DEADBEEF';
    process.env.LUMIGO_SECRET_MASKING_REGEX = 'NON-VALID-JSON';
    TracerGlobals.setTracerInputs({ token });

    const spans = [{ a: 'b', c: 'd' }, { e: 'f', g: 'h', error: 'error' }];

    const result = await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
    expect(result.rtt).toBeGreaterThanOrEqual(0);
  });

  test('forgeRequestBody - simple flow', async () => {
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const spans = [{ dummy }, { dummy }, { dummyEnd }];

    const expectedResult = [{ dummy }, { dummyEnd }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  test('forgeRequestBody - cut spans', async () => {
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';

    const spans = [{ dummy }, { dummy, error }, { dummyEnd }];
    const expectedResult = [{ dummy, error }, { dummyEnd }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  test('forgeRequestBody - prune trace off not cutting spans', async () => {
    utils.setPruneTraceOff();
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';
    const spans = [{ dummy }, { dummy, error }, { dummyEnd }];

    expect(reporter.forgeRequestBody(spans)).toEqual(JSON.stringify(spans));
    expect(reporter.forgeRequestBody([])).toEqual(undefined);
  });

  test('forgeRequestBody - empty list', async () => {
    expect(reporter.forgeRequestBody([])).toEqual(undefined);
  });
});
