#!/usr/bin/env bash
set -e

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout master
}

echo "Install a project with a clean state"
npm ci

echo "Build tracer"
npm run build
setup_git

echo "Pushing beta version to npm"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
BETA_VERSION="$(npm view @lumigo/tracer dist-tags.beta)"
BETA_VERSION=${BETA_VERSION:-0.0.0}
npm version --no-git-tag-version $BETA_VERSION
npm version --no-git-tag-version prepatch --preid beta
npm publish --tag beta
rm .npmrc

echo "Deploy to staging"
curl -u "$CIRCLECI_TOKEN": \
     -d build_parameters[CIRCLE_JOB]=force-deploy \
     https://circleci.com/api/v1.1/project/github/lumigo-io/backend-monitoring/tree/master

echo "Release with delay"
AWS_ACCESS_KEY_ID=$STAGING_AWS_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$STAGING_AWS_SECRET_ACCESS_KEY \
aws lambda invoke --function-name monitoring-prod_deploy-resources_step-function-invoker --payload '{"runtime": "node"}' --region us-west-1 response.json
