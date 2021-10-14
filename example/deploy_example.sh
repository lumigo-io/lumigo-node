#!/usr/bin/env bash
pushd ..
rm -rf lumigo-node-d_exmaple.tgz || true
npm run build
tracer="$(npm pack)"
mv $tracer lumigo-node-d_exmaple.tgz
popd
rm -rf package-lock.json
rm -rf node_modules
npm i
rm -rf dist/
#sls deploy --force