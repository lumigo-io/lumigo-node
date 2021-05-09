jest.mock('./http');
import { Http } from './http';
import * as utils from '../utils';
import hooksIndex from './index';
import { TracerGlobals } from '../globals';

describe('hooks index', () => {
  Http.mockImplementation(() => {
    return {
      hookHttp: jest.fn(),
    };
  });

  beforeEach(() => {
    Http.mockClear();
    Http.hookHttp.mockClear();
  });

  test('index -> simple flow', () => {
    hooksIndex();
    expect(Http.hookHttp).toHaveBeenCalled();
  });

  test('index -> switch off', () => {
    utils.setSwitchOff();
    TracerGlobals.setTracerInputs({});
    hooksIndex();
    expect(Http.hookHttp).not.toHaveBeenCalled();
  });

  test('index -> wrapping only once', () => {
    hooksIndex();
    hooksIndex();
    expect(Http.hookHttp).toHaveBeenCalledTimes(1);
  });
});
