module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '!./src/tools/xmlToJson.js',
    '!./src/testdata/functions/**/**.js',
  ],
  coverageThreshold: {
    global: {
      lines: 100,
    },
  },
  setupFilesAfterEnv: ['./testUtils/jest.setup.js'],
};
