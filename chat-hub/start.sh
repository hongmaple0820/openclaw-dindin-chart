#!/bin/bash
export PATH=$PATH:$HOME/.npm-global/bin
cd $(dirname $0)
node src/index.js
