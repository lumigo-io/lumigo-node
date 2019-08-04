#!/usr/bin/env bash
set -e

setup_git() {
    git config --global user.email "no-reply@build.com"
    git config --global user.name "CircleCI"
    git checkout master
}

echo "Install a project with a clean slate"
npm ci

echo "Build tracer"
npm run build
setup_git

echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Creating layer file"
./scripts/prepare_layer_files.sh

echo "Creating lumigo-node layer"
~/source/utils/common_bash/create_layer.sh lumigo-node-tracer ALL nodejs "nodejs10.x nodejs8.10"

echo "Updating README.MD with new ARN"
git add README.MD
git commit -m "Update README.MD layer ARN"

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
npm run semantic-release
rm .npmrc
