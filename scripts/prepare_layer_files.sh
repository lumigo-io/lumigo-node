#!/usr/bin/env bash
npm pack
mkdir -p nodejs
tracer="$(npm pack)"
pushd nodejs
npm init --yes
npm install --save "./../${tracer}"
popd