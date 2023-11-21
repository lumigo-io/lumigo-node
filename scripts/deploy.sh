#!/usr/bin/env bash
set -e

echo "Deleting old node_modules"
rm -rf node_modules

echo "Installing dependencies"
npm i

echo "Build tracer"
npm run build

echo "Setting production ad NODE_ENV"
export NODE_ENV=production

echo "Getting latest changes from git"
version="$(git describe --tags --abbrev=0)"
changes=$(git log "${version}..HEAD" --oneline)
echo "${changes}"

echo "Creating layer file"
./scripts/prepare_layer_files.sh

region="us-east-1"
echo "Creating lumigo-node layer to ${region}"
~/source/utils/common_bash/create_layer.sh \
    --layer-name lumigo-node-tracer \
    --region "$region" \
    --package-folder "nodejs lumigo_wrapper" \
    --version "$version" \
    --runtimes "nodejs10.x nodejs12.x nodejs14.x nodejs16.x nodejs18.x nodejs20.x"
