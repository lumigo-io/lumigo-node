import { TracerGlobals } from './globals';
import { getAWSEnvironment, getTracerInfo, httpReq } from './utils';
import { debug } from './logger';

export const SPAN_PATH = '/api/spans';
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
  const host = getEdgeHost();
  const path = SPAN_PATH;
  return { host, path };
};

export const sendSingleSpan = async span => exports.sendSpans([span]);

export const sendSpans = async spans => {
  const { token } = TracerGlobals.getTracerInputs();
  const { name, version } = getTracerInfo();

  const headers = {
    Authorization: token,
    'User-Agent': `${name}$${version}`,
    'Content-Type': 'application/json',
  };

  const method = 'POST';
  const { host, path } = getEdgeUrl();

  debug('Edge selected', { host, path });

  const reqBody = JSON.stringify(spans);
  const roundTripStart = Date.now();

  await httpReq({ method, headers, host, path }, reqBody);

  const roundTripEnd = Date.now();
  const rtt = roundTripEnd - roundTripStart;

  spans.map(span => debug('Span sent', span.id));

  return { rtt };
};
