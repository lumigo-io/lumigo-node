export default ({ enabled }) => {
  if (enabled) {
    require('./http_hook').default();
  }
};
