var findNodeModules = require('find-node-modules');

const res = findNodeModules({
  cwd: "../../", relative: false
});

console.log(res);