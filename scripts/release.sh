#!/usr/bin/env sh
set -e

npm version minor --no-git-tag-version
node ./scripts/syncManifestVersion.js

NEW_VERSION=$(node -p "require('./package.json').version")

git add package.json package-lock.json src/manifest.json
SKIP_PATCH_BUMP=1 git commit -m "chore: release v${NEW_VERSION}" -m "Co-Authored-By: codex <codex@openai.com>"
git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"
git push origin HEAD "v${NEW_VERSION}"

echo "Released v${NEW_VERSION}"
