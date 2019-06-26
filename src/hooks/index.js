export default ({ enabled }) => {
  if (enabled) {
    require('./http').default();
  }
};
