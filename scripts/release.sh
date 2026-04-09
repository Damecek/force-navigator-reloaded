#!/usr/bin/env sh
set -e

npm version minor --no-git-tag-version
node ./scripts/syncManifestVersion.js

NEW_VERSION=$(node -p "require('./package.json').version")

git add package.json package-lock.json src/manifest.json
SKIP_PATCH_BUMP=1 git commit -m "chore: release v${NEW_VERSION}"
git tag "v${NEW_VERSION}"
git push origin HEAD --follow-tags

echo "Released v${NEW_VERSION}"
