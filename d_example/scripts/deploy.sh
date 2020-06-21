#!/usr/bin/env bash

pushd ..
npm run build
npm pack
popd

rm -rf node_modules
npm i

sls deploy