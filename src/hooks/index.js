import httpHook from './http';
import {
  isSwitchedOff,
  isAwsEnvironment,
  isHttpWrapped,
  setHttpWrapped,
} from '../utils';

export default () => {
  if (!isHttpWrapped() && !isSwitchedOff() && isAwsEnvironment()) {
    httpHook();
    setHttpWrapped();
  }
};
