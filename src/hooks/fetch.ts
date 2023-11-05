import * as extender from '../extender';
import { SpansContainer, TracerGlobals } from '../globals';
import { FETCH_SPAN, getBasicChildSpan, getCurrentTransactionId } from '../spans/awsSpan';
import { getRandomId } from '../utils';
import { payloadStringify } from '../utils/payloadStringify';

export const beforeFetch = (args: any[], extenderContext: any) => {
  extenderContext.spanId = getRandomId();

  SpansContainer.addSpan({
    ...getBasicChildSpan(
      getCurrentTransactionId(),
      TracerGlobals.getHandlerInputs().context.awsRequestId,
      extenderContext.spanId,
      FETCH_SPAN
    ),
    // @ts-ignore
    started: Date.now(),
    url: args[0],
    options: args[1] || {},
  });
};

export const afterFetch = (args: any[], originalFnResult: any, extenderContext: any) => {
  const currentSpan = SpansContainer.getSpanById(extenderContext.spanId);
  // @ts-ignore
  currentSpan.ended = Date.now();
  originalFnResult.then((result: any) => {
    // @ts-ignore
    currentSpan.statusCode = result.status;
    if (result.ok) {
      result.text().then((text: string) => {
        // @ts-ignore
        currentSpan.response = payloadStringify(text);
        SpansContainer.addSpan(currentSpan);
      });
    } else {
      // @ts-ignore
      currentSpan.error = result.statusText;
      SpansContainer.addSpan(currentSpan);
    }
  });
};

export const hookFetch = () => {
  try {
    extender.hook(global, 'fetch', {
      beforeHook: beforeFetch,
      afterHook: afterFetch,
    });
  } catch (e) {
    console.log('hook fetch error', e);
  }
};
