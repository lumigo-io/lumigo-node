import * as extender from '../extender';
import {SpansContainer, TracerGlobals} from "../globals";
import {getBasicChildSpan, getCurrentTransactionId, MONGO_SPAN} from "../spans/awsSpan";
import {getRandomId} from "../utils";
import {payloadStringify} from "../utils/payloadStringify";


export const beforeFetch = (args: any[], extenderContext: any) => {
  extenderContext.spanId = getRandomId();

  SpansContainer.addSpan({
    ...getBasicChildSpan(
        getCurrentTransactionId(),
        TracerGlobals.getHandlerInputs().context.awsRequestId,
        extenderContext.spanId,
        MONGO_SPAN
    ),
  // @ts-ignore
    started: Date.now(),
    url: args[0],
    options: args[1] || {}
  });
}

export const afterFetch = (args: any[], originalFnResult: any, extenderContext: any) => {
    const currentSpan = SpansContainer.getSpanById(extenderContext.spanId);
    // @ts-ignore
  currentSpan.ended = Date.now();
    // @ts-ignore
  currentSpan.response = payloadStringify(originalFnResult);
    SpansContainer.addSpan(currentSpan);
}

export const hookFetch = () => {
  try{
    extender.hook(global, 'fetch', {
      beforeHook: beforeFetch,
      afterHook: afterFetch,
    });
  } catch (e) {
    console.log('hook fetch error', e);
  }
}
