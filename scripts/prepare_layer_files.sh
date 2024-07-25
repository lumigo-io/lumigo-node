#!/usr/bin/env bash

pushd auto-instrument-handler || exit 1
auto_inst="$(yarn pack)"
popd || exit 1

mkdir -p nodejs
tracer="$(yarn pack)"

pushd nodejs || exit 1
yarn init --yes
yarn install --save "./../${tracer}"
yarn install --save "./../auto-instrument-handler/${auto_inst}"
popd || exit 1

cp auto-instrument-handler/lumigo_wrapper .
