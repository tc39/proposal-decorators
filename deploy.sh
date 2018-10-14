#!/bin/bash

set -ev

# Pull requests and commits to other branches shouldn't try to deploy, just build to verify
if [[ "$TRAVIS_BRANCH" != master ]]; then
  echo "Skipping deploy; just doing a build."
  npm run build
  exit 0
fi

# Enable SSH authentication

ENCRYPTED_KEY_VAR="encrypted_${ENCRYPTION_LABEL}_key"
ENCRYPTED_IV_VAR="encrypted_${ENCRYPTION_LABEL}_iv"
ENCRYPTED_KEY=${!ENCRYPTED_KEY_VAR}
ENCRYPTED_IV=${!ENCRYPTED_IV_VAR}

if [[ $ENCRYPTED_KEY == "" ]]; then
    echo "Auto-deploy GitHub key missing; exiting without a build"
    exit 0
fi

$(npm bin)/set-up-ssh --key "$ENCRYPTED_KEY" \
                      --iv "$ENCRYPTED_IV" \
                      --path-encrypted-key "$PRIVATE_KEY_FILE_NAME"

# Update the content from the `gh-pages` branch

$(npm bin)/update-branch --commands "mkdir out && ecmarkup spec.html out/index.html" \
                         --commit-message "Update gh-pages [skip ci]" \
                         --directory "out" \
                         --distribution-branch "gh-pages" \
                         --source-branch "master"

