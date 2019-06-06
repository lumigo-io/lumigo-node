import { isSwitchedOff, isAsyncFn } from './utils';
import { getFunctionSpan, getEndFunctionSpan } from './spans/aws_span';
import { sendSingleSpan, sendSpans } from './reporter';
import { TracerGlobals, SpansHive } from './globals';

export const startTrace = async () => {
  if (!isSwitchedOff()) {
    const functionSpan = getFunctionSpan();
    await sendSingleSpan(functionSpan);
    return functionSpan;
  } else {
    return {};
  }
};

export const endTrace = async (functionSpan, handlerReturnValue) => {
  if (!isSwitchedOff()) {
    const endFunctionSpan = getEndFunctionSpan(
      functionSpan,
      handlerReturnValue
    );
    SpansHive.addSpan(endFunctionSpan);

    const spans = SpansHive.getSpans();
    await sendSpans(spans);
  }
};
export const callbackResolver = resolve => (err, data) =>
  resolve({ err, data, type: 'callbacked' });

// See https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
export const promisifyUserHandler = (userHandler, event, context) =>
  new Promise(resolve => {
    if (isAsyncFn(userHandler)) {
      return userHandler(event, context, callbackResolver(resolve))
        .then(data =>
          resolve({ err: null, data, type: 'async_handler_resolved' })
        )
        .catch(err =>
          resolve({ err, data: null, type: 'async_handler_rejected' })
        );
    } else {
      try {
        const result = userHandler(event, context, callbackResolver(resolve));
        resolve({ err: null, data: result, type: 'non_async_returned' });
      } catch (err) {
        resolve({ err, data: null, type: 'non_async_errored' });
      }
    }
  });

// XXX Promisify userHandler for non-async handlers, and Promise.all with the Epilogue
export const trace = ({
  token,
  edgeHost,
  switchOff,
  eventFilter,
}) => userHandler => async (event, context, callback) => {
  TracerGlobals.setHandlerInputs({ event, context });
  TracerGlobals.setTracerInputs({ token, edgeHost, switchOff, eventFilter });

  const pStartTrace = startTrace();
  const pUserHandler = promisifyUserHandler(
    userHandler,
    event,
    context,
    callback
  );

  const [functionSpan, handlerReturnValue] = await Promise.all([
    pStartTrace,
    pUserHandler,
  ]);

  await endTrace(functionSpan, handlerReturnValue);

  console.log(handlerReturnValue);

  return handlerReturnValue;
};
