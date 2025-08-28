#!/usr/bin/env bash

pushd auto-instrument-handler || exit 1
auto_inst="$(npm pack)"
popd || exit 1

mkdir -p nodejs
tracer="$(npm pack)"

pushd nodejs || exit 1
npm init --yes
npm install --save "./../${tracer}"
npm install --save "./../auto-instrument-handler/${auto_inst}"
popd || exit 1

cp auto-instrument-handler/lumigo_wrapper .
