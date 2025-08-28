# Contributing to lumigo-node

We would ❤️ for you to contribute and help us add to cool features! 🙏 

# Getting Started

- Make sure you have [node](https://nodejs.org/en/) `>=12.x` installed.

# Developing

Start by installing all dependencies:

```shell
npm i
```

#### Run the tests:

```shell
./scripts/checks.sh
```

#### Run the example:
Setting up your env:
- In `example/index.js` change `const token = "XXX"` your Lumigo token (can get from https://platform.lumigo.io/onboarding)
- Run:
```shell
cd example
npm i
./deploy_example
sls invoke -f test-function
```

## Coding Rules

To ensure consistency throughout the source code, keep these rules in mind as you are working:

- All features or bug fixes **must be tested** by one or more specs (unit-tests).
- Any new hook must uses the `extender` lib

### Commit Message Format

We using [semantic-release](https://semantic-release.gitbook.io/semantic-release/#commit-message-format)

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special
format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

```
fix(release): need to depend on the latest shimmer

The version in our package.json gets copied to the one we publish, and users need the latest of these.
```
