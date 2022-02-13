import * as lumigo from '@lumigo/tracer';
import { Handler } from 'aws-lambda';

const lumigoToken = "123";

export const trace = (callback: Handler) => {
  if (process.env.isRunningTests) return callback;
  if (lumigoToken == null) {
    console.warn(
      `Attempted to trace the function, however, there is no 'LUMIGO_TOKEN' environment variable. Did you add it?
      Proceeding without tracing this function.`,
    );

    return callback;
  }

  return lumigo.initTracer({ token: lumigoToken }).trace(callback);
};


trace(()=>{

})
