#!/usr/bin/env bash
pushd ..
rm -rf lumigo-node-d_exmaple.tgz || true
yarn build
tracer="$(yarn pack)"
mv $tracer lumigo-node-d_exmaple.tgz
popd
rm -rf package-lock.json
rm -rf node_modules
yarn install
rm -rf dist/
#sls deploy --force