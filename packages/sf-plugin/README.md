# Force Navigator Reloaded for sf CLI

Search the Force Navigator Reloaded command catalog against an authenticated Salesforce org, then open the selected page.

Build and link from a checkout of the repository with Node.js 22 or newer and Salesforce CLI:

```sh
cd packages/sf-plugin
npm ci
npm run build
sf plugins link .
```

```sh
sf navigator search "account fields" --target-org dev
sf navigator open "flow onboarding" --target-org uat
sf navigator open --id new-flow --target-org dev
```

Use `--source` more than once to limit dynamic API queries. `--refresh` bypasses the six-hour local cache. `navigator open --url-only` prints a credential-free destination URL and never creates or prints a Salesforce login URL.

Scripts can use `--json`. If an open query has multiple matches in JSON or a non-interactive terminal, the command exits with an error and asks for a more specific query or exact `--id`.

Commands open Salesforce pages without saving records or changing metadata. Login As and extension-specific actions are excluded. Salesforce features and permissions determine which destinations can be used in an org.

The npm package name is `sf-plugin-force-navigator-reloaded`. Publishing is separate from building this checkout; after a package release, install it with `sf plugins install sf-plugin-force-navigator-reloaded`.

See the [full CLI guide](https://github.com/Damecek/force-navigator-reloaded/blob/main/docs/cli-plugin.md) for source families, caching, and validation.
