# Salesforce CLI navigation plugin

The plugin searches Salesforce navigation destinations and opens the selected page in an authenticated org. It shares
queries, command definitions, and accent-insensitive fuzzy matching with the browser extension.

## Install from this checkout

Use Node.js 22 or newer and Salesforce CLI. Build and link the plugin:

```bash
cd packages/sf-plugin
npm ci
npm run build
sf plugins link .
sf navigator search --help
```

The package name is `sf-plugin-force-navigator-reloaded`. Linking is a local development installation. An npm release
is a separate publishing step; opening or merging the implementation PR does not publish a package.

## Search and open

Pass an existing Salesforce CLI alias or username with `--target-org` / `-o`, or use the standard CLI default org.

```bash
sf navigator search "account fields" -o my-dev
sf navigator search "flow onboarding" -o my-uat --source flows --json
sf navigator open "account fields" -o my-dev
sf navigator open --id sobject-setup-fields-and-relationship-Account -o my-dev
sf navigator open --id app-home -o my-dev --url-only --json
```

An interactive open command offers a selection when the search is ambiguous. Use an exact command ID from search
results for scripts. IDs containing Salesforce record IDs belong to the selected org and must be resolved again when
targeting a different org.

`--url-only` returns a normal destination URL, not an authenticated login link. Opening that URL independently requires
an existing browser session. Normal `open` authenticates the browser using Salesforce CLI without including the login
URL in the command result.

Use `--source` to restrict loading to a family and `--refresh` to rebuild cached results. Available sources are `static`,
`setup`, `objects`, `flows`, `apex-classes`, `apex-triggers`, `experience-sites`, `apps`, `permission-sets`,
`permission-set-groups`, and `users`.

Cached catalogs expire after six hours and are isolated by org, username, API version, catalog version, and selected
sources. Use `--refresh` after changing permissions or org metadata. A source error is reported separately from an empty
source; successful sources remain searchable, while failure of every selected source exits unsuccessfully. JSON search
results include `commands`, `errors`, `cached`, and `generatedAt` so scripts can reject incomplete results when needed.

## Scope

The catalog includes Setup and personal settings, Object Manager sections, object list and new-record pages, custom
metadata list and new-record pages, flow definitions and versions, unmanaged Apex classes and triggers, Experience
Cloud workspaces and builders, Lightning apps, permission sets and groups, and active users. Static destinations include
the developer tools already offered by the extension. Availability depends on the org's features and user permissions.

Commands navigate to Salesforce UI. Opening a new-record page does not save a record. Login As, extension authorization,
extension settings, usage tracking, and Chrome-specific actions are not part of this plugin. Switching a Lightning app
from the CLI opens that app without retaining a page from an existing browser tab.

The CLI has its own source selection and cache. It does not read Chrome settings or tokens. By default it includes all
CLI sources, Object Manager sections, and available flow variants. The browser extension retains its existing defaults.

Web Console launch could not be verified in the validation sandboxes: its direct Setup-domain URL also returned Home
from an authenticated Setup session. The command retains the extension's destination, but a successful IDE launch
depends on availability for the target user. See the validation report for the observed limitation.

## Architecture

`src/navigator` owns the shared catalog. Its connection interface returns complete record arrays from `query` and
`toolingQuery`; the CLI adapter uses Salesforce CLI authentication and follows query pagination. Salesforce API requests
retain the repository's `SALESFORCE_API_VERSION` pin.

`packages/sf-plugin` provides the Salesforce CLI commands, filesystem cache, terminal selection, and authenticated
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
