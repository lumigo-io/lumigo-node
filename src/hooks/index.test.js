import * as utils from '../utils';
import { hookHttp } from './http';
import hooksIndex from './index';
import { TracerGlobals } from '../globals';

jest.mock('./http');
describe('hooks index', () => {
  beforeEach(() => {
    hookHttp.mockClear();
  });

  test('index -> simple flow', () => {
    hooksIndex();
    expect(hookHttp).toHaveBeenCalled();
  });

  test('index -> switch off', () => {
    utils.setSwitchOff();
    TracerGlobals.setTracerInputs({});
    hooksIndex();
    expect(hookHttp).not.toHaveBeenCalled();
  });

  test('index -> wrapping only once', () => {
    hooksIndex();
    hooksIndex();
    expect(hookHttp).toHaveBeenCalledTimes(1);
  });
});
