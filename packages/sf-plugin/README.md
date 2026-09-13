# Force Navigator Reloaded for sf CLI

Open the Force Navigator Reloaded command palette in your terminal and choose a Salesforce page to open in an authenticated org.

Build and link from a checkout of the repository with Node.js 22 or newer and Salesforce CLI:

```sh
cd packages/sf-plugin
npm ci
npm run build
sf plugins link .
```

```sh
sf navigator open --target-org dev
sf navigator open "flow onboarding" --target-org uat
sf navigator open --target-org dev --source apex-classes
```

`--target-org` falls back to the configured default org. `open` always shows the palette, including when only one result
matches. An optional query prefills the editable input. Type to filter, use `↑`/`↓` to move, `Enter` to open, and `Esc`
to cancel. An interactive terminal is required; JSON output and scripted selection are unsupported.

Frequently used commands appear first, followed by alphabetical label order. Usage history is local to the org and user
and separate from Chrome. Enter `? text` in the palette to open Salesforce global record search.

Default navigation families, Object Manager sections, and flow variants match the extension. Apex classes and triggers
are opt-in through `--source`. Repeat `--source` to limit API queries to selected families. `--refresh` bypasses the
six-hour local cache, and `--browser` selects a browser. Authentication uses the existing Salesforce CLI login without
printing a login URL.

Running a linked build prints a Salesforce CLI warning about a linked ESM module that cannot be auto-transpiled. It is informational; the built `lib` output is used.

Commands open Salesforce pages without saving records or changing metadata. Login As and extension-specific actions are excluded. Salesforce features and permissions determine which destinations can be used in an org.

The npm package name is `sf-plugin-force-navigator-reloaded`. Publishing is separate from building this checkout; after a package release, install it with `sf plugins install sf-plugin-force-navigator-reloaded`.

See the [full CLI guide](https://github.com/Damecek/force-navigator-reloaded/blob/main/docs/cli-plugin.md) for source families, caching, and validation.
