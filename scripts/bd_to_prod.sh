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

echo "Push to NPM"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
npm run semantic-release

echo "Creating layer file"
./scripts/prepare_layer_files.sh

echo "Creating lumigo-node layer"
../utils/common_bash/create_layer.sh --layer-name lumigo-node-tracer --region ALL --package-folder "nodejs lumigo_wrapper" --version $(git describe --abbrev=0 --tags) --runtimes "nodejs10.x nodejs12.x nodejs14.x nodejs16.x nodejs18.x nodejs20.x"

echo "Creating layer latest version arn table md file (LAYERS.md)"
cd ../larn && npm i -g
larn -r nodejs12.x -n layers/LAYERS12x --filter lumigo-node-tracer -p ~/lumigo-node
larn -r nodejs14.x -n layers/LAYERS14x --filter lumigo-node-tracer -p ~/lumigo-node
larn -r nodejs16.x -n layers/LAYERS16x --filter lumigo-node-tracer -p ~/lumigo-node
larn -r nodejs18.x -n layers/LAYERS18x --filter lumigo-node-tracer -p ~/lumigo-node
larn -r nodejs20.x -n layers/LAYERS20x --filter lumigo-node-tracer -p ~/lumigo-node
cd ../lumigo-node
git add layers/LAYERS12x.md
git add layers/LAYERS14x.md
git add layers/LAYERS16x.md
git add layers/LAYERS18x.md
git add layers/LAYERS20x.md
git commit -m "docs: layers md [skip ci]"

source ../utils/common_bash/functions.sh
send_metric_to_logz_io type=\"Release\"

git push origin master

