module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: ['**/src/**/**/**/**.js', '!./src/tools/xmlToJson.js'],
  coverageThreshold: {
    global: {
      lines: 100,
    },
  },
};
