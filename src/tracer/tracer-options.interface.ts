export interface TracerOptions {
  token?: string;
  debug?: boolean;
  edgeHost?: string;
  switchOff?: boolean;
  stepFunction?: boolean;
  maxSizeForRequest?: number | null;
  maxSizeForRequestOnError?: number | null;
  lambdaTimeout?: number;
  verbose?: boolean;
}
