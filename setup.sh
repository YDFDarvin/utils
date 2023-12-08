#!/bin/bash
FOLDER="$(pwd -P)/${1}"

echo "folder = $FOLDER"

# npm ci --prefer-offline
./node_modules/.bin/git-hooks-wrapper init "$FOLDER/git-hooks"
git config include.path "$FOLDER/.gitconfig" && \
"$FOLDER/git-hooks/post-checkout"