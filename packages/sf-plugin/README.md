# Force Navigator Reloaded for sf CLI

Open the Force Navigator Reloaded command palette in your terminal and choose a Salesforce page to open in an authenticated org.

## Install

Install [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli), then install the published plugin:

```sh
sf plugins install force-navigator-reloaded
```

The first npm release is pending. This command becomes available after that release.
Salesforce CLI downloads the built package and dependencies. No checkout or local build is required.
The CLI runtime must use Node.js 22.19.0 or newer. Salesforce CLI may ask you to trust this unsigned community plugin.

## Use

```sh
sf navigator open --target-org dev
sf navigator open "flow onboarding" --target-org uat
sf navigator open --target-org dev --source apex-classes
sf navigator open --target-org dev --exclude-source apex-classes --exclude-source apex-triggers
sf navigator open --target-org dev --debug --refresh
```

`--target-org` falls back to the configured default org. `open` always shows the palette, including when only one result
matches. An optional query prefills the editable input. Type to filter, use `↑`/`↓` to move, `Enter` to open, and `Esc`
to cancel. An interactive terminal is required; JSON output and scripted selection are unsupported.

Results use aligned `Command`, `Source`, and `Uses` columns. Frequently used commands appear first, followed by alphabetical label order. Usage history is local to the org and user
and separate from Chrome. Enter `? text` in the palette to open Salesforce global record search.

All supported navigation families, Object Manager sections, and flow variants are enabled by default, including Apex
and Service Setup. Extension defaults are unchanged. Repeat `--source` to load only selected families, or repeat
`--exclude-source` to omit families. Exclusions also apply to an explicit `--source` selection and take precedence.
Leaving no sources is an error.

`--refresh` bypasses the six-hour local cache. A loading spinner identifies the user while fetching commands from the
org on a cache miss or refresh, then stops before the palette opens. Cached catalogs and static-only selections do not
show the org-loading spinner. `--browser` selects a browser. Authentication uses the existing Salesforce CLI login
without printing a login URL.

Add `--debug` to show cache status, cache read/write timings, and total catalog time, command count, and source error
count after the loading spinner stops and before the palette opens. Each query page shows REST or Tooling API, the
queried object, any numeric `LIMIT` or `OFFSET`, elapsed time, and record count. A cache hit avoids catalog queries;
combine `--debug --refresh` to measure requests to the org. Debug output omits full SOQL, returned org records,
authentication tokens, login URLs, and error payloads.

Commands open Salesforce pages without saving records or changing metadata. Login As and extension-specific actions are excluded. Salesforce features and permissions determine which destinations can be used in an org.

## Update or uninstall

Run `sf plugins update` to update installed plugins, or repeat the install command to update only Navigator.
Remove it with `sf plugins uninstall force-navigator-reloaded`.

See the [full CLI guide](https://github.com/Damecek/force-navigator-reloaded/blob/main/docs/cli-plugin.md) for source families, caching, and validation.
For local builds and linking, see [Contribute](https://github.com/Damecek/force-navigator-reloaded/blob/main/docs/cli-plugin.md#contribute).
