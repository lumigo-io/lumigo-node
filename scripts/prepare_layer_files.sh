#!/usr/bin/env bash
npm pack
mkdir -p nodejs
pushd nodejs
npm init --yes
npm install --save ./../lumigo-node-tracer-1.0.9.tgz
popd