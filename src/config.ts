import { SSM } from 'aws-sdk';
import * as logger from './logger';

export interface Config {
  domainScrubbers: RegExp[];
}

export let config: Config;

const LUMIGO_DEFAULT_DOMAIN_SCRUBBERS =
  '["secretsmanager.*.amazonaws.com", "ssm.*.amazonaws.com", "kms.*.amazonaws.com", "sts..*amazonaws.com"]';

const setConfig = async () => {
  logger.debug('Loading config');

  let domainScrubberString: string;
  if (process.env.LUMIGO_DOMAINS_SCRUBBER_SSM) {
    logger.debug(
      `Loading config for domains scrubber from SSM parameter ${process.env.LUMIGO_DOMAINS_SCRUBBER_SSM}`
    );
    const ssmResponse = await new SSM()
      .getParameter({
        Name: process.env.LUMIGO_DOMAINS_SCRUBBER_SSM,
      })
      .promise();
    if (!ssmResponse.Parameter?.Value) {
      throw new Error(`No SSM value for ${process.env.LUMIGO_DOMAINS_SCRUBBER_SSM}`);
    }
    domainScrubberString = ssmResponse.Parameter.Value;
  } else {
    domainScrubberString = process.env.LUMIGO_DOMAINS_SCRUBBER || LUMIGO_DEFAULT_DOMAIN_SCRUBBERS;
  }
  const domainScrubbers = JSON.parse(domainScrubberString).map((x) => new RegExp(x, 'i'));

  config = {
    domainScrubbers,
  };
  logger.debug('Loading config completed');
};

void setConfig();
