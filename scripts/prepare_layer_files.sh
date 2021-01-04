#!/usr/bin/env bash
pushd auto-instrument-handler
auto_inst="$(npm pack)"
popd
mkdir -p nodejs
tracer="$(npm pack)"
pushd nodejs
npm init --yes
npm install --save "./../${tracer}"
npm install --save "./../auto-instrument-handler/${auto_inst}"
popd
cp auto-instrument-handler/lumigo_wrapper .
