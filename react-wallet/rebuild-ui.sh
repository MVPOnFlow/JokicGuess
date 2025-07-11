#!/usr/bin/env bash
rm -r ../react-build
npm run build
cp -r dist ../react-build