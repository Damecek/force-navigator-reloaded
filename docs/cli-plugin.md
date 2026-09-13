# Salesforce CLI navigation plugin

The plugin provides an interactive Salesforce navigation palette. Select a page to open it in an authenticated org. It shares
queries, command definitions, and accent-insensitive fuzzy matching with the browser extension.

## Install from this checkout

Use Node.js 22 or newer and Salesforce CLI. Build and link the plugin:

```bash
cd packages/sf-plugin
npm ci
npm run build
sf plugins link .
sf navigator open --help
```

The package name is `sf-plugin-force-navigator-reloaded`. Linking is a local development installation. An npm release
is a separate publishing step; opening or merging the implementation PR does not publish a package.

A linked ESM plugin prints `Warning: ... is a linked ESM module and cannot be auto-transpiled` on every run. This is
Salesforce CLI behavior for `sf plugins link`, not an error; the built `lib` output is used. Installing the published
package with `sf plugins install` does not show the warning.

## Open the palette

Pass an existing Salesforce CLI alias or username with `--target-org` / `-o`. Without the flag the command uses the
configured default org (`sf config set target-org <alias>`), so `-o` is only required when no default is set.

```bash
sf navigator open -o my-dev
sf navigator open "account fields" -o my-dev
sf navigator open "flow onboarding" -o my-uat --source flows
sf navigator open -o my-dev --refresh --browser chrome
```

`open` always shows the interactive palette, even when only one command matches. An optional query prefills the input;
you can edit or clear it to search the whole loaded catalog. Type to filter, use `↑`/`↓` to move, and press `Enter` to
open. `Esc` or `Ctrl+C` cancels without opening a page. The palette requires an interactive terminal and does
not support JSON output or scripted selection.

Matching ignores Latin diacritics and highlights matched terms, as in the extension. Matching commands are ordered by
usage count, then alphabetically by label. Successful opens update local history for the selected org and user; this
history is separate from Chrome and does not store record search terms. Type `? text` to select Salesforce global record search for that text.

Use `--browser` to choose a browser. Opening a destination authenticates the browser using Salesforce CLI without
printing the login URL.

Use `--source` more than once to restrict loading to selected families and `--refresh` to rebuild cached results.
Available sources are `static`, `setup`, `objects`, `flows`, `apex-classes`, `apex-triggers`, `experience-sites`, `apps`,
`permission-sets`, `permission-set-groups`, and `users`. Apex classes and triggers are opt-in, for example
`sf navigator open -o my-dev --source apex-classes`.

Cached catalogs expire after six hours and are isolated by org, username, API version, catalog version, and selected
sources. Use `--refresh` after changing permissions or org metadata. A source error is reported separately from an empty
source; successful sources remain searchable, while failure of every selected source exits unsuccessfully.

## Scope

Default navigation families match the extension: Setup and personal settings, objects and custom metadata, flows,
Experience Cloud, Lightning apps, permission sets and groups, and active users, plus static destinations. Availability
depends on org features and user permissions. Unmanaged Apex classes and triggers can be loaded with `--source`.

Object Manager sections and flow variants use the extension defaults. This includes fields, Lightning pages, buttons
and actions, record types, object Apex and Flow triggers, and validation rules. Flow definitions and latest versions
are enabled; active versions are disabled. The CLI does not expose the extension's settings editor or read its custom
settings, tokens, or history.

Commands navigate to Salesforce UI. Opening a new-record page does not save a record. Login As, extension authorization,
extension settings, and Chrome-specific actions are outside the plugin's scope. Switching a Lightning app opens that
app without retaining the page from an existing browser tab.

Web Console launch could not be verified in the earlier validation sandboxes: its direct Setup-domain URL also returned
Home from an authenticated Setup session. The command retains the extension's destination, but a successful IDE launch
depends on availability for the target user. See the validation report for the observed limitation.

## Architecture

`src/navigator` owns the shared catalog. Its connection interface returns complete record arrays from `query` and
`toolingQuery`; the CLI adapter uses Salesforce CLI authentication and follows query pagination. Salesforce API requests
retain the repository's `SALESFORCE_API_VERSION` pin.

`packages/sf-plugin` provides the Salesforce CLI commands, filesystem cache and usage history, terminal selection, and authenticated
browser opening. Its build packages a copy of the shared source into the distribution so an installed plugin does not
depend on a checkout of this repository. Make changes in `src/navigator`, not in generated plugin files.

Browser authentication uses Salesforce Core's `getFrontDoorUrl` with a relative destination path, as required by the
[Single Access UI Bridge API](https://help.salesforce.com/s/articleView?id=sf.frontdoor_singleaccess.htm&language=en_US&type=5).
The single-use authenticated URL stays in memory and is passed directly to the browser opener.

## Validation

Run the extension regression tests, lint, and development build from the repository root:

```bash
npm test
npm run lint
npm run dev-build
```

Run the plugin checks from its package directory:

```bash
cd packages/sf-plugin
npm ci
npm test
npm pack --dry-run
```

Live navigation tests require an explicitly selected, already authorized org and Chrome. They must verify destination
content after Salesforce redirects, including embedded Setup pages. An absent feature or empty source must be reported
as unavailable rather than counted as a successful page check. Do not save records, activate flows, deploy metadata, or
publish Experience sites as part of navigation tests. Never put login URLs, authentication tokens, browser session data,
or raw org records in committed test artifacts.

See the [live browser test instructions](../packages/sf-plugin/test-e2e/README.md) for the route matrix and runner.
The [implementation validation report](cli-validation.md) records package checks and live navigation coverage.
