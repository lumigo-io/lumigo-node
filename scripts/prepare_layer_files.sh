#!/usr/bin/env bash
pushd auto_instrument_handler
auto_inst="$(npm pack)"
popd
mkdir -p nodejs
tracer="$(npm pack)"
pushd nodejs
npm init --yes
npm install --save "./../${tracer}"
npm install --save "./../auto_instrument_handler/${auto_inst}"
popd