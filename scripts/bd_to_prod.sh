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

echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Creating new credential files"
enc_location=../common-resources/encrypted_files/credentials_production.enc
if [[ ! -f ${enc_location} ]]
then
    echo "$enc_location not found"
    exit 1
fi

mkdir -p ~/.aws
echo ${KEY} | gpg --batch -d --passphrase-fd 0 ${enc_location} > ~/.aws/credentials

echo "Creating layer file"
./scripts/prepare_layer_files.sh

echo "Creating lumigo-node layer"
../utils/common_bash/create_layer.sh lumigo-node-tracer ALL nodejs "nodejs10.x node12.x"

echo "Creating layer latest version arn table md file (LAYERS.md)"
cd ../larn && npm i -g
larn -r nodejs10.x -n layers/LAYERS10x --filter lumigo-node-tracer -p ~/lumigo-node
larn -r nodejs12.x -n layers/LAYERS12x --filter lumigo-node-tracer -p ~/lumigo-node
cd ../lumigo-node
git add layers/LAYERS10x.md
git add layers/LAYERS12x.md
git commit -m "docs: layers md"

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
npm run semantic-release
echo "Pushing beta version to npm"
BETA_VERSION="$(npm view @lumigo/tracer dist-tags.beta)"
BETA_VERSION=${BETA_VERSION:-0.0.0}
npm version --no-git-tag-version $BETA_VERSION
npm version --no-git-tag-version prepatch --preid beta
npm publish --tag beta
rm .npmrc
