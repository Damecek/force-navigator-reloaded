# Salesforce browser end-to-end tests

These tests load the live catalog and resolve sample destinations through the plugin's internal catalog and navigation services. They authenticate a clean Chrome session through `@salesforce/core` and verify visible page identity after Salesforce redirects and iframe loads. This route matrix does not exercise the terminal palette; automated plugin tests cover selection and command behavior.

Run only against explicitly selected, authorized orgs:

```sh
SF_NAVIGATOR_E2E_ORGS=my-dev,my-uat npm run test:e2e
```

The matrix contains one representative command for every distinct route shape. A route unavailable in an org is reported as skipped. Tracing, screenshots, and video are disabled because the initial navigation uses a single-use frontdoor URL. The runner never prints or persists that URL.

After separately proving that a feature is unavailable in the target org, list its exact command ID explicitly:

```sh
SF_NAVIGATOR_E2E_ORGS=my-dev SF_NAVIGATOR_E2E_UNAVAILABLE=feature-command-id npm run test:e2e
```

The runner includes every supported source, including Apex classes and triggers. It enables all supported Object Manager sections and flow variants, matching the CLI catalog. Missing commands are skipped separately from passed routes.
