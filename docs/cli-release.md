# Release runbook

Both products share a repository but have independent versions and publishing workflows.

| Release               | Version source                                     | Tag                    | Start release                                      |
| --------------------- | -------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| Browser extension     | Root `package.json`, synced to `src/manifest.json` | `v<version>`           | `npm run release`                                  |
| Salesforce CLI plugin | `packages/sf-plugin/package.json`                  | `sf-plugin-v<version>` | Manually run `publish-cli.yml` for an existing tag |

Every new GitHub release contains `force-navigator-reloaded-<extension-version>.zip` and `force-navigator-reloaded-<plugin-version>.tgz`, built from the same tagged checkout. The extension release workflow publishes to the Chrome Web Store. The CLI workflow publishes to npm. Uploading a tarball to GitHub does not publish that package to npm.

An extension-tag tarball contains the plugin code from that extension tag. If plugin code changed since its last npm release, the tarball can differ from the npm package carrying the same plugin version. Bump and publish the plugin separately when those changes should reach `sf plugins update` users.

## Current npm setup

The initial `force-navigator-reloaded@0.1.0` publication is complete. The temporary GitHub `NPM_TOKEN` secret was deleted after publication. Revoking the temporary token on npm is the owner's remaining cleanup responsibility.

**Trusted Publisher configuration has not been verified.** Before the next npm release, check **force-navigator-reloaded → Settings → Trusted Publisher** on npmjs.com. Select GitHub Actions and configure:

| npm field            | Value                      |
| -------------------- | -------------------------- |
| Organization or user | `Damecek`                  |
| Repository           | `force-navigator-reloaded` |
| Workflow filename    | `publish-cli.yml`          |
| Environment name     | Leave empty                |

Allow direct publishing with `npm publish`. The workflow file and npm settings must match exactly. Normal releases use [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) through GitHub Actions OIDC and need no npm secret. The workflow uses a GitHub-hosted runner, Node.js 24, npm 11, and `id-token: write`.

Leave **bootstrap** disabled. It was used once to create the npm package and is not a fallback for OIDC errors. Do not recreate `NPM_TOKEN` for routine releases.

## Checks before either release

Start from a clean checkout containing the reviewed release changes. Run the extension checks from the repository root:

```sh
npm ci
npm test
npm run lint
npm run dev-build
```

Run plugin tests and verify the packaged installation:

```sh
cd packages/sf-plugin
npm ci
npm test
npm pack --dry-run
npm run test:package
cd ../..
```

A release publishes externally. Confirm that the user's request authorizes the intended release before pushing a release tag or dispatching publication. Merging a PR alone does not request a new release.

## Browser extension release

1. Start from clean, up-to-date `main` with the reviewed changes and passing checks.
2. Run `npm run release` from the repository root. It increments the extension minor version, synchronizes the manifest, creates an annotated `v<version>` tag, and pushes the release commit and tag. The normal commit hook handles patch bumps between releases.
3. Wait for `.github/workflows/package.yml` to finish. Verify that the GitHub release contains both the extension ZIP and plugin tarball, and inspect the Chrome Web Store publication result.

A regular code push does not start a release. This path does not change the plugin version or publish to npm. Manual dispatch of the extension workflow rebuilds the selected extension tag and also runs its store publication steps.

## Salesforce CLI plugin release

1. Verify Trusted Publishing using the npm settings above. Start from reviewed changes on `main` and choose a new plugin semver version.
2. Bump locally, then run the checks above against the final version:

   ```sh
   cd packages/sf-plugin
   npm version patch --no-git-tag-version
   cd ../..
   ```

   Use `minor` or `major` instead of `patch` when appropriate. Do not edit version fields manually.

3. Commit the package and lockfile changes. Replace `0.1.1` below with the version in `packages/sf-plugin/package.json`:

   ```sh
   git add packages/sf-plugin/package.json packages/sf-plugin/package-lock.json
   SKIP_PATCH_BUMP=1 git commit -m "chore: release Salesforce CLI plugin 0.1.1"
   git tag -a sf-plugin-v0.1.1 -m "Salesforce CLI plugin 0.1.1"
   git push origin HEAD sf-plugin-v0.1.1
   ```

   `SKIP_PATCH_BUMP` prevents a plugin-only release commit from bumping the extension version. Follow the repository's PR process if direct pushes to `main` are restricted; create the tag on the merged commit instead.

4. In GitHub Actions, run **Publish Salesforce CLI plugin** from `main` and enter the exact tag. Leave **bootstrap** and **artifacts_only** disabled. The workflow validates the version, runs checks, builds both archives, publishes the plugin to npm, and attaches both archives to the tag's GitHub release.
5. Wait for CI and verify the npm version and both GitHub release assets. Test installation in a separate Salesforce CLI environment:

   ```sh
   sf plugins install force-navigator-reloaded
   sf navigator open --help
   sf plugins update
   ```

The npm archive includes the built commands and shared navigation code. Users need Salesforce CLI; they do not need this repository or its build tools. Local builds and `sf plugins link` are for contributors.

## Recover missing GitHub assets

If npm publication already succeeded, do not attempt to publish the same version again. npm versions cannot be reused.

For a plugin release, run **Publish Salesforce CLI plugin** from `main`, enter its existing `sf-plugin-v<version>` tag, enable **artifacts_only**, and leave **bootstrap** disabled. This builds and attaches both archives without invoking npm publication. It also repairs the initial `sf-plugin-v0.1.0` release, which predates the artifact upload steps.

Verify both assets on the release page after the workflow completes. Report npm publication, GitHub assets, and Chrome Web Store publication separately; success in one destination does not prove the others succeeded.
