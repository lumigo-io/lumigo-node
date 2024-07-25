#!/usr/bin/env bash
set -e

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout master
}

echo "Install a project with a clean state"
yarn install --frozen-lockfile

echo "Build tracer"
yarn build
setup_git

echo "Pushing beta version to npm"
cat <<EOL > .yarnrc.yml
npmRegistryServer: "https://registry.npmjs.org"
npmAuthToken: "${NPM_TOKEN}"
EOL
BETA_VERSION="$(yarn info @lumigo/tracer dist-tags.beta)"
BETA_VERSION=${BETA_VERSION:-0.0.0}
yarn version --no-git-tag-version $BETA_VERSION
yarn version --no-git-tag-version prepatch --preid beta
yarn publish --tag beta
rm .yarnrc.yml

echo "Deploy to staging"
curl -u "$CIRCLECI_TOKEN": \
     -d build_parameters[CIRCLE_JOB]=force-deploy \
     https://circleci.com/api/v1.1/project/github/lumigo-io/backend-monitoring/tree/master

echo "Release with delay"
AWS_ACCESS_KEY_ID=$STAGING_AWS_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$STAGING_AWS_SECRET_ACCESS_KEY \
aws lambda invoke --function-name monitoring-prod_deploy-resources_step-function-invoker --payload '{"runtime": "node"}' --region us-west-1 response.json
