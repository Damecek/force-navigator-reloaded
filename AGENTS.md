<!--
  AGENTS.md
  This file provides instructions for AI agents working in this repository.
-->

# Instructions

- The user will provide a task.
- Wait for all terminal commands to be completed (or terminate them) before finishing.
- When adding new command sources, update the related constants, default settings, and README.md.
- When implementing a new user-visible key feature or materially changing an advertised feature, update both README.md and `web/web-store-listing.md`. Keep the store copy concise, benefit-led, in English, and limited to verified behavior. Do not hard-wrap `web/web-store-listing.md` inside sentences or paragraphs; use line breaks only between listing sections.
- When changing Settings JSON keys, structure, or defaults (`src/shared/settings.js` / `src/shared/constants.js`), also update `docs/options-settings-reference.md`.
- When running a development build during agent work, use `npm run dev-build` unless the task explicitly requires watch
  mode.
- Navigation queries, descriptor builders, and fuzzy matching shared by the extension and Salesforce CLI plugin live in
  `src/navigator`. Keep this directory independent of Chrome, LWC, authentication, storage, and build-time globals.
  Update the shared implementation instead of maintaining separate command definitions in the plugin.
- Keep the CLI centered on the interactive `navigator open` palette. Its optional query only prefills editable input;
  opening always requires confirmation. Shared palette defaults and ordering belong in `src/navigator`.
- When changing the CLI plugin or shared navigation core, run the extension checks and the plugin tests and packaging
  checks in `packages/sf-plugin`. Live browser tests require explicitly selected, authorized orgs. Report unavailable
  Salesforce features separately from passed route checks, and never commit login URLs, tokens, or browser sessions.

# AGENTS.md spec

- Containers often contain AGENTS.md files. These files can appear anywhere in the container's filesystem. Typical
  locations include `/`, `~`, and in various places inside of Git repos.
- These files are a way for humans to give you (the agent) instructions or tips for working within the container.
- Some examples might be: coding conventions, info about how code is organized, or instructions for how to run or test
  code.
- AGENTS.md files may provide instructions about PR messages (messages attached to a GitHub Pull Request produced by the
  agent, describing the PR). These instructions should be respected.
- Instructions in AGENTS.md files:
  - The scope of an AGENTS.md file is the entire directory tree rooted at the folder that contains it.
  - For every file you touch in the final patch, you must obey instructions in any AGENTS.md file whose scope includes
    that file.
  - Instructions about code style, structure, naming, etc. apply only to code within the AGENTS.md file's scope,
    unless the file states otherwise.
  - More-deeply-nested AGENTS.md files take precedence in the case of conflicting instructions.
  - Direct system/developer/user instructions (as part of a prompt) take precedence over AGENTS.md instructions.
- AGENTS.md files need not live only in Git repos. For example, you may find one in your home directory.
- If the AGENTS.md includes programmatic checks to verify your work, you MUST run all of them and make a best effort to
  validate that the checks pass AFTER all code changes have been made.
  - This applies even for changes that appear simple, i.e. documentation. You still must run all of the programmatic
    checks.

# Modularity Preference

- Follow a modular structure: separate distinct responsibilities into individual files.
  - Initialization logic, event listeners, and business logic should each reside in their own modules.
  - For example, in `src/content_scripts`, `content.js` mounts the LWC app.
  - In `src/background`, `index.js` delegates command handling to `commandListener.js`.
  - Place all LWC modules under `src/lwc/modules` and keep them split by context:
    `shared`, `content`, `options`, `welcome`.
  - When adding new features, maintain this pattern to ensure clarity, testability, and ease of maintenance.
- Prefer using ES6 modules (`import`/`export`) over CommonJS (`require`) for modularity.
- Prefer using async/await to .then().catch() to callbacks for async operations.
- Update markdown documents as part of your work.
  - AGENTS.md contains instructions for AI agents working in this repository. Add or update instructions as repeated
    patterns are discovered.
  - README.md describes the project and its features.
- Use JSDoc comments to document public APIs and to introduce types for parameters and return values.
- Do not litter code with comments //.
- Use `console.log` for debugging; logs are stripped in production builds, so avoid excessive or obsolete statements.
- For long-running command executions, emit explicit loading events from command classes so `app` can toggle loading indicators without command-id filtering.
- Keep Salesforce REST and Tooling API requests pinned through `SALESFORCE_API_VERSION`. Advance the pin deliberately,
  one version at a time, only after every command source has been validated against both the current production release
  and a preview org. During preview windows, do not select a version newer than the current production release. Do not
  derive the version dynamically per org.

# Releases

- Before releasing, read `docs/cli-release.md`. It covers both products, CI workflows, authentication, and artifact recovery.
- Every new GitHub release must contain both the extension `force-navigator-reloaded-<extension-version>.zip` and the CLI plugin `force-navigator-reloaded-<plugin-version>.tgz`, built from the release tag. Verify both assets after CI finishes.
- Extension `v<version>` releases use `npm run release`; plugin npm releases use independent `sf-plugin-v<version>` tags and the manual `publish-cli.yml` workflow. Attaching a plugin tarball to an extension release does not publish it to npm.
- The npm bootstrap is complete. Use Trusted Publishing for future npm releases; verify its npm configuration before publishing. Do not recreate `NPM_TOKEN` or enable bootstrap as a routine fallback.
- If npm publication succeeded but GitHub assets are missing, use `publish-cli.yml` with `artifacts_only` enabled for the existing plugin tag. Never republish an existing npm version.

# Versioning

- Versions follow semver and are managed **locally**. CI never commits back to the repo.
- The rules below apply to the root extension version. The plugin version in `packages/sf-plugin` is independent; bump it with `npm version patch --no-git-tag-version` in that directory, choosing minor or major when appropriate. Commit its package and lockfile changes before tagging.
- **Patch** bumps happen automatically on every `git commit` via the `.husky/pre-commit` hook.
  - The hook runs `npm version patch`, syncs `src/manifest.json`, and stages the version files.
  - To skip the automatic bump (e.g. during amend or rebase), set `SKIP_PATCH_BUMP=1`.
- **Minor** bumps happen via `npm run release`, which also tags and pushes.
  - Use `npm run release` instead of `git push` when you want to publish a new version.
  - Regular `git push` pushes code but does not trigger a release.
- Never modify version fields in `package.json` or `src/manifest.json` manually — the hooks and scripts handle it.
- `scripts/syncManifestVersion.js` keeps `src/manifest.json` version in sync with `package.json`.
