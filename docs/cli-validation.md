# CLI plugin validation

## Current interactive-only interface

The plugin now exposes only the interactive `navigator open` palette.

- Extension: 97 regression tests, ESLint, development build, and production build passed. Production retains webpack bundle-size warnings.
- Plugin: 40 tests passed on Node.js 22 and Node.js 26, covering confirmation, cancellation, editing prefilled text, usage ordering and persistence, global search descriptors, and existing navigation safeguards.
- Packaging: `npm pack --dry-run` passed. An actual tarball was installed outside the repository and its help verified to expose only the interactive command and supported flags.
- Terminal: a real PTY confirmed that a unique prefilled match waits for Enter, Ctrl+U clears it, and typing `? Acme` selects global record search.
- Browser runner: all 46 tests were discovered successfully without contacting an org. Live navigation, including the new global-search entry point, has not been rerun because no org was selected for this work.

The results below are historical evidence for the earlier implementation, not proof that the revised interface passes live browser checks.

The current browser runner loads all supported sources, including opt-in Apex, and resolves sample destinations through internal catalog and navigation
services. It does not depend on removed public scripting commands and does not exercise the terminal palette.

## Historical validation

The earlier plugin interface was validated against two explicitly authorized Salesforce sandboxes. This report uses
generic sandbox labels and omits org identifiers, record names, authenticated URLs, and browser session data.

### Earlier automated and package checks

- Extension regression suite: 92 tests passed.
- Extension ESLint, development build, and production build passed. The production build reports webpack bundle-size warnings.
- Plugin suite: 26 tests passed on Node.js 22. Tests cover catalog loading and fuzzy matching, REST and Tooling pagination, cache isolation and expiry, malformed cache recovery, destination validation, authenticated opening, browser launch failures, interactive selection, and command output/error behavior.
- The package was built and tested with Node.js 22. An actual npm tarball was installed into a separate directory and executed against a sandbox without access to the repository's source tree.
- Dependency audits passed the high-severity threshold. Moderate findings remain in existing extension dependencies and the Salesforce SDK dependency tree.

### Earlier command-line checks

Before simplification, live checks exercised full-catalog refresh, source filtering, fuzzy search, exact-ID resolution, safe URL-only JSON output, native Chrome launch, interactive selection, Ctrl+C cancellation, ambiguous noninteractive queries, and missing IDs.

The development sandbox returned 7,002 commands across all 11 sources without a source error. This is catalog coverage; browser coverage samples each distinct navigation route and does not visit every metadata record.

### Earlier browser method

The earlier Playwright runner loaded the real CLI catalog and resolved samples through the now-removed exact-ID and URL-only command interface. It then invoked the plugin's authenticated-opening implementation with Chrome navigation as the injected opener. Assertions inspect the final route and visible page content, including legacy Salesforce iframes.

For Lightning apps and Experience Cloud, Salesforce can replace the original navigation URL. These checks also retain navigation requests in memory to verify the selected app/site identifier and inspect the resulting UI. The runner does not persist those requests.

Tests only open pages. They do not save records, activate flows, deploy metadata, or publish sites. Browser traces, screenshots, and videos are disabled. Missing catalog features are reported separately from successful navigation.

See [the runner instructions](../packages/sf-plugin/test-e2e/README.md) to repeat the checks with explicitly selected org aliases.

The earlier browser matrix covered these route variants in each sandbox, plus a check that every catalog command belongs to a classified route family:

| Source           | Navigation scenarios                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup            | Setup and personal settings                                                                                                                                                                       |
| Objects          | Standard object details and all 14 Object Manager sections; standard and custom object new-record/list pages; custom object details/fields using DurableId; custom metadata new-record/list pages |
| Flows            | Definition, latest version, active version                                                                                                                                                        |
| Apex             | Class and trigger details                                                                                                                                                                         |
| Experience Cloud | Workspace and Builder for the selected site                                                                                                                                                       |
| Apps             | Standard and custom/namespaced Lightning apps                                                                                                                                                     |
| Permissions      | Permission set and permission set group details                                                                                                                                                   |
| Users            | Selected user details                                                                                                                                                                             |
| Static           | New custom object, new Flow, Flow Trigger Explorer, application Home, Files, Developer Console, Web Console, Agentforce Vibes                                                                     |

### Earlier browser results

All **44 available navigation variants passed in both sandboxes**, along with catalog classification. Web Console is the remaining, explicitly unvalidated variant out of the 45 navigation cases.

| Run                                                              | Development sandbox                                       | UAT sandbox                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Full matrix on the final plugin build                            | 43 passed, 2 identity-assertion failures, 1 explicit skip | 43 passed, 2 identity-assertion failures, 1 explicit skip |
| Targeted reruns after correcting the affected browser assertions | All affected cases passed                                 | All affected cases passed                                 |
| Resolved navigation coverage                                     | 44 passed; Web Console unvalidated                        | 44 passed; Web Console unvalidated                        |

The full runs' failures came from reading only semantic main-content elements in interfaces whose identifying text lives elsewhere. Narrow collectors were added for the affected interfaces. App and Experience redirects also verify their final surface; Agentforce Vibes verifies the external Salesforce IDE after its redirect. The final strict Vibes check passed in both sandboxes. No plugin implementation changes were made between these full runs and targeted reruns.

These results combine full-matrix runs and successful targeted reruns; they do not claim a single uninterrupted green full run. The checks validate one representative of each route variant, not every record in the catalog.

### Earlier Web Console limitation

Initial live runs reached Lightning Home instead of Web Console in both sandboxes. In the UAT sandbox, opening the same credential-free Setup-domain destination after loading a normal authenticated Setup page also returned Home. Omitting or changing the domain-probe flag did not change that result, and there was no Web Console settings entry in the user's discovered Setup catalog.

These observations do not establish successful Web Console launch or prove a CLI-specific defect. The shared command and its tested Setup-domain URL remain available. Web Console must be recorded as unavailable/unvalidated in these sandboxes, not as a successful browser check. The final runner can explicitly skip this diagnosed case with `SF_NAVIGATOR_E2E_UNAVAILABLE=web-console`; no commands are skipped by that setting by default.

Service Setup is outside the CLI catalog: the shared Setup query includes `Setup` and `PersonalSettings`, matching the extension's existing query. It is not counted as a missing sandbox capability.
