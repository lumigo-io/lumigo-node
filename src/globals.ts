import * as logger from './logger';
import type { TracerOptions } from './tracer';
import type { LambdaContext } from './types/aws/awsEnvironment';
import { BasicSpan } from './types/spans/basicSpan';
import {
  getAutoTagKeys,
  getJSONBase64Size,
  getMaxSizeForStoredSpansInMemory,
  isLambdaTraced,
  spanHasErrors,
} from './utils';
import { GlobalDurationTimer } from './utils/globalDurationTimer';
import { isString } from '@lumigo/node-core/lib/common';
import { runOneTimeWrapper } from './utils/functionUtils';

const MAX_TAGS = 50;
const MAX_TAG_KEY_LEN = 50;
const MAX_TAG_VALUE_LEN = 70;
const ADD_TAG_ERROR_MSG_PREFIX = 'Skipping addExecutionTag: Unable to add tag';
export const DEFAULT_MAX_SIZE_FOR_REQUEST = 1024 * 500;
export const DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR = 1024 * 990;
export const DEFAULT_MAX_SIZE_FOR_SPANS_STORED_IN_MEMORY =
  DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR * 10;
export const MAX_TRACER_ADDED_DURATION_ALLOWED = 750;
export const MIN_TRACER_ADDED_DURATION_ALLOWED = 200;

const warnSpansSizeOnce = runOneTimeWrapper((threshold: number, currentSize: number) => {
  logger.info(
    `Lumigo tracer is no longer collecting data on the invocation - maximum size of total spans collected (${threshold} bytes allowed, current size is ${currentSize} bytes)`
  );
}, {});
export enum droppedSpanReasons {
  SPANS_STORED_IN_MEMORY_SIZE_LIMIT = 'SPANS_STORED_IN_MEMORY_SIZE_LIMIT',
  INVOCATION_MAX_LATENCY_LIMIT = 'INVOCATION_MAX_LATENCY_LIMIT',
}

export class SpansContainer {
  private static spans: { [id: string]: BasicSpan } = {};
  private static currentSpansSize: number = 0;
  private static totalSpans: number = 0;
  private static droppedSpansReasons: { [reason: string]: number } = {};

  static addSpan(span: BasicSpan): boolean {
    const newSpan = span.id in this.spans;
    if (!newSpan) {
      // We call add span also for updating spans with their end part
      this.totalSpans += 1;
    }
    // Memory optimization, take up to 10x maxSize because of smart span selection logic
    const maxSpansSize = getMaxSizeForStoredSpansInMemory();
    if (spanHasErrors(span) || this.currentSpansSize <= maxSpansSize) {
      this.spans[span.id] = span;

      // TODO: If the span isn't new we need to subtract the old span size before adding the new size
      this.currentSpansSize += getJSONBase64Size(span);
      logger.debug('Span created', span);
      return true;
    }

    logger.debug('Span was not added due to size limitations', {
      currentSpansSize: this.currentSpansSize,
      maxSpansSize,
    });
    warnSpansSizeOnce(maxSpansSize, this.currentSpansSize);

    if (newSpan) {
      SpansContainer.recordDroppedSpan(droppedSpanReasons.SPANS_STORED_IN_MEMORY_SIZE_LIMIT, false);
    }
    // TODO: If the span isn't new we need to mark the existing span as partially dropped / truncated somehow

    return false;
  }

  static recordDroppedSpan(
    reason: droppedSpanReasons,
    incrementTotalSpansCounter: boolean = true,
    numOfDroppedSpans: number = 1
  ): void {
    this.droppedSpansReasons[reason] =
      (this.droppedSpansReasons[reason.valueOf()] || 0) + numOfDroppedSpans;
    if (incrementTotalSpansCounter) {
      this.totalSpans += numOfDroppedSpans;
    }
  }

  static getDroppedSpansReasons(): { [reason: string]: number } {
    return this.droppedSpansReasons;
  }

  static getSpans(): BasicSpan[] {
    return Object.values(this.spans);
  }

  static getSpanById(spanId: string): BasicSpan | null {
    return this.spans[spanId];
  }

  static changeSpanId(oldId: string, newId: string): void {
    const oldSpan = this.spans[oldId];
    if (oldSpan) {
      oldSpan.id = newId;
      this.spans[newId] = oldSpan;
      this.totalSpans -= 1;
    }
    delete this.spans[oldId];
  }

  static clearSpans(): void {
    this.currentSpansSize = 0;
    this.totalSpans = 0;
    this.spans = {};
  }

  static getTotalSpans(): number {
    return this.totalSpans;
  }
}

export const GlobalTimer = (() => {
  let currentTimer = undefined;

  const setGlobalTimeout = (func, duration) => {
    clearTimer();
    currentTimer = setTimeout(func, duration);
    currentTimer.unref();
  };

  const clearTimer = () => {
    clearTimeout(currentTimer);
  };

  return { setGlobalTimeout, clearTimer };
})();

export const ExecutionTags = (() => {
  // @ts-ignore
  global.tags = [];

  interface AutoTagEvent {
    event: string;
    keyToEvent: any;
    relativeKey: string;
  }
  const validateTag = (key, value, shouldLogErrors = true) => {
    key = String(key);
    value = String(value);
    if (key.length < 1 || key.length > MAX_TAG_KEY_LEN) {
      shouldLogErrors &&
        logger.warnClient(
          `${ADD_TAG_ERROR_MSG_PREFIX}: key length should be between 1 and ${MAX_TAG_KEY_LEN}: ${key} - ${value}`
        );
      return false;
    }
    if (value.length < 1 || value.length > MAX_TAG_VALUE_LEN) {
      shouldLogErrors &&
        logger.warnClient(
          `${ADD_TAG_ERROR_MSG_PREFIX}: value length should be between 1 and ${MAX_TAG_VALUE_LEN}: ${key} - ${value}`
        );
      return false;
    }
    // @ts-ignore
    if (global.tags.length >= MAX_TAGS) {
      shouldLogErrors &&
        logger.warnClient(
          `${ADD_TAG_ERROR_MSG_PREFIX}: maximum number of tags is ${MAX_TAGS}: ${key} - ${value}`
        );
      return false;
    }
    return true;
  };

  const normalizeTag = (val) => (val === undefined || val === null ? null : String(val));

  const addTag = (key, value, shouldLogErrors = true) => {
    try {
      if (isLambdaTraced()) {
        logger.debug(`Adding tag: ${key} - ${value}`);
        if (!validateTag(key, value, shouldLogErrors)) {
          return false;
        }
        // @ts-ignore
        global.tags.push({ key: normalizeTag(key), value: normalizeTag(value) });
      } else {
        shouldLogErrors && logger.warnClient(`${ADD_TAG_ERROR_MSG_PREFIX}: lambda is not traced`);
        return false;
      }
    } catch (err) {
      shouldLogErrors && logger.warnClient(ADD_TAG_ERROR_MSG_PREFIX);
      logger.warn(ADD_TAG_ERROR_MSG_PREFIX, err);
      return false;
    }
    return true;
  };

  // @ts-ignore
  const getTags = () => [...global.tags];

  // @ts-ignore
  const clear = () => (global.tags = []);

  const getValue = (autoTagEvent: AutoTagEvent, innerKey) => {
    const relativeKey = autoTagEvent.relativeKey
      ? [autoTagEvent.relativeKey, innerKey].join('.')
      : innerKey;
    let obj = autoTagEvent.event;
    const eventByKey = autoTagEvent.keyToEvent;
    if (obj && obj[innerKey]) {
      eventByKey[relativeKey] = obj;
      return { event: obj[innerKey], keyToEvent: eventByKey, relativeKey: relativeKey };
    }
    if (eventByKey && eventByKey[relativeKey]) {
      obj = eventByKey[relativeKey];
      return obj && { event: obj[innerKey], keyToEvent: eventByKey, relativeKey: relativeKey };
    }
    try {
      if (obj && isString(obj) && obj[innerKey] === undefined) {
        const parsedObj = JSON.parse(obj);
        eventByKey[relativeKey] = parsedObj;
        return (
          parsedObj && {
            event: parsedObj[innerKey],
            keyToEvent: eventByKey,
            relativeKey: relativeKey,
          }
        );
      }
    } catch (err) {
      logger.debug('Failed to parse json event as tag value', { error: err, event: obj });
    }
    return { event: undefined, keyToEvent: eventByKey, relativeKey: relativeKey };
  };

  const autoTagEvent = (event) => {
    let keyToEventMap: {} = {};
    getAutoTagKeys().forEach((key) => {
      const value: AutoTagEvent = key
        .split('.')
        .reduce(getValue, { event: event, keyToEvent: keyToEventMap, relativeKey: '' });
      keyToEventMap = value.keyToEvent;
      value.event && addTag(key, value.event);
    });
  };

  return { addTag, getTags, clear, validateTag, autoTagEvent };
})();

export const TracerGlobals = (() => {
  const handlerInputs: { event: {}; context: LambdaContext | {} } = {
    event: {},
    context: {},
  };

  const tracerInputs = {
    token: '',
    debug: false,
    edgeHost: '',
    switchOff: false,
    isStepFunction: false,
    maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
    maxSizeForRequestOnError: DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR,
    maxSizeForStoredSpansInMemory: DEFAULT_MAX_SIZE_FOR_SPANS_STORED_IN_MEMORY,
    lambdaTimeout: MAX_TRACER_ADDED_DURATION_ALLOWED,
  };

  const setHandlerInputs = ({ event, context }) => {
    Object.assign(tracerInputs, {
      lambdaTimeout: context.getRemainingTimeInMillis(),
    });
    return Object.assign(handlerInputs, {
      event,
      context,
    });
  };

  const getLambdaTimeout = () => tracerInputs.lambdaTimeout;

  const getHandlerInputs = (): { event: {}; context: LambdaContext | any } => handlerInputs;

  const clearHandlerInputs = () => Object.assign(handlerInputs, { event: {}, context: {} });

  const setTracerInputs = ({
    token = '',
    debug = false,
    edgeHost = '',
    switchOff = false,
    stepFunction = false,
    maxSizeForRequest = null,
    maxSizeForRequestOnError = null,
    lambdaTimeout = MAX_TRACER_ADDED_DURATION_ALLOWED,
    maxSizeForStoredSpansInMemory = DEFAULT_MAX_SIZE_FOR_SPANS_STORED_IN_MEMORY,
  }: TracerOptions) => {
    const parsedMaxSizeForRequestOnError =
      maxSizeForRequestOnError ||
      (process.env['LUMIGO_MAX_SIZE_FOR_REQUEST_ON_ERROR']
        ? parseInt(process.env.LUMIGO_MAX_SIZE_FOR_REQUEST_ON_ERROR)
        : DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR);
    const parsedMaxSizeForStoredSpansInMemory =
      maxSizeForStoredSpansInMemory || parsedMaxSizeForRequestOnError * 10;
    Object.assign(tracerInputs, {
      token: token || process.env.LUMIGO_TRACER_TOKEN,
      debug: debug,
      edgeHost: edgeHost || process.env.LUMIGO_TRACER_HOST,
      switchOff: switchOff,
      lambdaTimeout: lambdaTimeout,
      isStepFunction:
        stepFunction ||
        !!(
          process.env['LUMIGO_STEP_FUNCTION'] &&
          process.env.LUMIGO_STEP_FUNCTION.toUpperCase() === 'TRUE'
        ),
      maxSizeForRequest:
        maxSizeForRequest ||
        (process.env['LUMIGO_MAX_SIZE_FOR_REQUEST']
          ? parseInt(process.env.LUMIGO_MAX_SIZE_FOR_REQUEST)
          : DEFAULT_MAX_SIZE_FOR_REQUEST),
      maxSizeForRequestOnError: parsedMaxSizeForRequestOnError,
      maxSizeForStoredSpansInMemory: parsedMaxSizeForStoredSpansInMemory,
    });
  };

  const getTracerInputs = () => tracerInputs;

  const clearTracerInputs = () =>
    Object.assign(tracerInputs, {
      token: '',
      debug: false,
      edgeHost: '',
      switchOff: false,
      isStepFunction: false,
      maxSizeForRequest: DEFAULT_MAX_SIZE_FOR_REQUEST,
      maxSizeForRequestOnError: DEFAULT_MAX_SIZE_FOR_REQUEST_ON_ERROR,
      maxSizeForStoredSpansInMemory: DEFAULT_MAX_SIZE_FOR_SPANS_STORED_IN_MEMORY,
    });

  return {
    getTracerInputs,
    setTracerInputs,
    setHandlerInputs,
    getHandlerInputs,
    getLambdaTimeout,
    clearTracerInputs,
    clearHandlerInputs,
  };
})();

export const clearGlobals = () => {
  GlobalDurationTimer.reset();
  SpansContainer.clearSpans();
  TracerGlobals.clearHandlerInputs();
  GlobalTimer.clearTimer();
  ExecutionTags.clear();
};
