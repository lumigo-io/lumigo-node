module.exports = {
  silent: true,
  testEnvironment: "node",
  coverageDirectory: "./coverage/",
  collectCoverage: true,
  collectCoverageFrom: [
    "**/src/**/**/**/**.js",
    "**/src/**/**/**/**.ts",
    "!./src/tools/xmlToJson.js",
    "!./src/testdata/functions/**/**.js",
    "!./d_example/**/**",
  ],
  coverageThreshold: {
    global: {
      lines: 100,
    },
  },
  setupFilesAfterEnv: [ "./testUtils/jest.setup.js" ],
  roots: [ "<rootDir>/src" ],
  modulePaths: [ "<rootDir>/dist" ],
};
