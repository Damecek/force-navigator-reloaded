# Publish the Salesforce CLI plugin

The npm package `force-navigator-reloaded` has its own version and `sf-plugin-v<version>` tags. Browser extension releases use `v<version>` tags and do not publish this package.

## One-time setup

Normal releases use [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) from GitHub Actions. npm authorizes this specific workflow using OIDC, so subsequent releases need no npm secret. The workflow uses a GitHub-hosted runner, Node.js 24, npm 11, and `id-token: write`.

The package must exist before its Trusted Publisher can be configured. For this new package, publish the first real version through the same CI workflow with a temporary token:

1. Merge `.github/workflows/publish-cli.yml` into the default branch so GitHub exposes its manual workflow. Prepare the `sf-plugin-v0.1.0` tag as described below.
2. In an npm account authorized to create `force-navigator-reloaded`, create a temporary granular token with write permission to create and publish the package and Bypass two-factor authentication enabled. Store it as the repository Actions secret `NPM_TOKEN`. See [npm token setup](https://docs.npmjs.com/creating-and-viewing-access-tokens).
3. Run **Publish Salesforce CLI plugin** with tag `sf-plugin-v0.1.0` and enable **bootstrap**. This publishes the first version from CI.
4. On npmjs.com, open **force-navigator-reloaded → Settings → Trusted Publisher**, select **GitHub Actions**, and enter the values below. Allow direct publishing with `npm publish`.
5. Revoke the temporary npm token and delete the GitHub `NPM_TOKEN` secret. Leave **bootstrap** disabled for every subsequent release.

| npm field            | Value                      |
| -------------------- | -------------------------- |
| Organization or user | `Damecek`                  |
| Repository           | `force-navigator-reloaded` |
| Workflow filename    | `publish-cli.yml`          |
| Environment name     | Leave empty                |

The workflow file and npm settings must match exactly. The bootstrap option is only for creating the initial package; it is not an automatic fallback when OIDC authorization fails.

## Release

Start from a clean checkout containing the reviewed release changes. Run the extension checks from the repository root:

```sh
npm ci
npm test
npm run lint
npm run dev-build
```

Set the plugin version locally with npm. Skip the version command for the initial `0.1.0` release:

```sh
cd packages/sf-plugin
npm version patch --no-git-tag-version
npm ci
npm test
npm pack --dry-run
npm run test:package
cd ../..
```

Commit the plugin package files and create a matching tag. Replace `0.1.1` below with the version in `packages/sf-plugin/package.json`:

```sh
git add packages/sf-plugin/package.json packages/sf-plugin/package-lock.json
SKIP_PATCH_BUMP=1 git commit -m "chore: release Salesforce CLI plugin 0.1.1"
git tag -a sf-plugin-v0.1.1 -m "Salesforce CLI plugin 0.1.1"
git push origin HEAD sf-plugin-v0.1.1
```

For the initial release, tag the commit containing version `0.1.0`; no version-only commit is needed. The `SKIP_PATCH_BUMP` setting prevents the extension hook from bumping the browser extension for a plugin-only release.

In GitHub Actions, run **Publish Salesforce CLI plugin** and enter the exact tag. The workflow checks that the tag matches the plugin version, installs dependencies, runs the dependency audit and plugin tests, verifies installation outside the checkout, and builds a tarball before publishing it. Leave **bootstrap** disabled to authenticate through Trusted Publishing. A version already published to npm cannot be reused.

After publication, verify the user installation in a separate Salesforce CLI environment:

```sh
sf plugins install force-navigator-reloaded
sf navigator open --help
sf plugins update
```

The npm archive includes the built commands and shared navigation code. Users need Salesforce CLI; they do not need this repository or its build tools. Local builds and `sf plugins link` are for contributors.
