import got from 'got';
import { TracerGlobals } from './globals';
import { getAWSEnvironment, getTracerInfo, isDebug } from './utils';

export const SPAN_PATH = 'api/spans';
export const LUMIGO_TRACER_EDGE = 'lumigo-tracer-edge.golumigo.com';

export const getAwsEdgeHost = () => {
  const { awsRegion } = getAWSEnvironment();
  return `${awsRegion}.${LUMIGO_TRACER_EDGE}`;
};

export const getEdgeHost = () => {
  const { edgeHost } = TracerGlobals.getTracerInputs();
  if (edgeHost) {
    return edgeHost;
  }
  const awsEdgeHost = getAwsEdgeHost();
  return awsEdgeHost;
};

export const getEdgeUrl = () => {
  const edgeHost = getEdgeHost();
  return `https://${edgeHost}/${SPAN_PATH}`;
};

export const sendSingleSpan = async span => exports.sendSpans([span]);

export const logSpans = spans =>
  // eslint-disable-next-line
  spans.map(span => console.log(`#LUMIGO# ${JSON.stringify(span, null, 2)}`));

export const sendSpans = async spans => {
  const { token } = TracerGlobals.getTracerInputs();
  const { name, version } = getTracerInfo();

  const headers = {
    Authorization: token,
    'User-Agent': `${name}$${version}`,
    'Content-Type': 'application/json',
  };

  const edgeUrl = getEdgeUrl();
  const body = JSON.stringify(spans);
  const roundTripStart = Date.now();

  await got.post(edgeUrl, { headers, body });

  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  isDebug() && logSpans(spans);

  return { rtt };
};
