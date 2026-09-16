# Authorization onboarding audit

Tested on September 15, 2026 against `carvago-dev` (`carvago--devas`) in Chrome 152.0.7977.83.
This concerns general extension authorization, independently of auto-login.

The reported missing-installation error was reproduced, followed by successful authorization after administrator installation. No human passkey was needed for the completed test.

## Confirmed behavior

- The development build completed with `npm ci` and `npm run dev-build`.
- The tested extension ID is `fjcokiadigpmkojdlhbkbhimkcmjokon`, version 5.16.1.
- Initially, Connected Apps OAuth Usage listed **Force Navigator Reloaded Dev** as **Allowed**, with **Block** and **Install** actions. It was not installed or blocked.
- The build and the org's installation action both identify the development client as `DEV_CONSUMER_KEY`. Its appearance alone is not evidence of an invalid client.
- Login As was insufficient for this test: it produced **Insufficient Privileges** on the authorization page and `Authorization page could not be loaded.` in the extension.
- A synthetic nonadmin user was then authenticated through the API and registered with `sf org login access-token`. The CLI's browser-open operation returned `Bad_OAuth_Token` for that SOAP-derived session; passing that same session directly to frontdoor in memory and completing initial password setup established the user's own browser session.
- The user's ID was verified in the Lightning runtime. The temporary profile enabled API access and Lightning Experience, with login restricted to the test machine's single IP. It did not grant approval of uninstalled connected apps.
- Executing **Extension > Authorize** requested `api refresh_token`, without the auto-login `web` scope.
- The OAuth window reached `/setup/secur/RemoteAccessErrorPage.apexp` with `error=invalid_client` and `error_description=app must be installed into org`.
- While that page remained open, `launchWebAuthFlow` stayed pending and the frontend received no failure message.
- Closing the OAuth window rejected the promise with `The user did not approve access.` The frontend received exactly that message through `failedAuthFlow`, without the Salesforce error description.
- After administrator installation through **Connected Apps OAuth Usage**, the same user received the normal consent page. Clicking **Allow** completed authorization. The extension published `completedAuthFlow` and stored access and refresh tokens with `refresh_token api` scope.

## Error-page observability

In this Chrome version, `chrome.tabs.query` included the OAuth error page. DevTools execution-context inspection also confirmed the extension's existing content script running in its own isolated world on that page.

The sampled `tabs.onUpdated` listener recorded no events for the failed flow. Do not rely on that listener alone: the existing My Domain content script is the demonstrated entry point for reading the terminal error URL.

Implementation should parse only the required error fields, send a structured failure to the background, and associate it with an active authorization attempt and its originating tab/org. An arbitrary Salesforce OAuth error page must not be assumed to belong to this extension. The complete auth URL and tokens must not enter user-facing messages or copied diagnostics.

Detection is feasible without replacing `launchWebAuthFlow` or adding host permissions for the tested My Domain URL. Failure reporting, attempt correlation, and recovery UI are proposals, not implemented changes.

## Native toast feasibility

The extension bundles LWC OSS, not Salesforce's Lightning base component runtime. Direct use of `lightning/toast` or `lightning/platformShowToastEvent` is not currently configured.

A page-context call to `window.$A.get('e.force:showToast')` successfully displayed a sticky toast in Lightning Setup and above the open extension command palette. DOM visibility, hit testing, and a screenshot confirmed the toast was not hidden by the palette backdrop.

The existing Lightning navigation bridge is a candidate for delivering toast requests to the host. Actual bridge integration, dismissal, and help links still need testing. The Salesforce OAuth error page does not provide the Lightning toast host; a toast in the originating tab alone does not guide someone who is still looking at the OAuth window. Recovery must also cover that window, for example with contextual help or a verified return to the originating tab.

References:

- [Salesforce toast guide](https://developer.salesforce.com/docs/platform/lwc/guide/use-toast)
- [force:showToast](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/force-show-toast.html)

## What the frontend receives

`src/background/index.js` catches authorization errors and publishes `failedAuthFlow` with `data: { message }` to the initiating tab. `src/lwc/modules/content/x/app/app.js` logs that data and stops the loading indicator. Production builds preserve `console.error`.

There is no structured error category or separate Salesforce error description. `src/background/auth/auth.js` checks only for an authorization code in the callback. An error page remaining on Salesforce does not automatically supply its query parameters to that callback.

## Test setup and cleanup

A synthetic user was created specifically for this test:

- User ID: `005AP00000sH237YAC`
- Username: `fnr.auth.audit.20260915@carvago.example.invalid`
- Initial and restored profile: Sales Employee.
- Temporary test profile: FNR Auth Audit, with API access, Lightning Experience, and one allowed login IP.

Initial direct login required email verification. A temporary `SkipIdentityConfirmation` permission set did not remove that challenge. Adding one IP to the org's trusted ranges failed because its existing configuration exceeds the current range limit; the failed deployment made no changes. A separate temporary profile with a single login IP enabled API authentication without a security token and allowed the test to proceed without human verification.

Cleanup completed:

- Uninstalled the app again and verified **Allowed** with an **Install** action. The final OAuth usage user count was zero; test login/denial history remains.
- Deactivated the synthetic user and restored its Sales Employee profile. Salesforce user records cannot be deleted.
- Removed the temporary permission-set assignment, permission set, and test profile.
- Logged the synthetic user out of the CLI and cleared the isolated test extension's local/session storage.
- Retrieved Security settings again and verified that all 29 original org trusted IP ranges are unchanged.

No passwords, access tokens, refresh tokens, or verification codes are included in this report. No product code was changed.

## Agreed content scope

- Welcome: authorization steps, administrator installation prerequisite, and troubleshooting.
- README: remove the claim that approving extension access is always sufficient; distinguish org installation from developer metadata deployment.
- `web/web-store-listing.md`: concise authorization and administrator prerequisite before installation.
- Popup help: a reachable authorization-help link.
- Settings: no additional authorization information or UI in this task.

Prefer an actionable sticky error with a help link for confirmed errors. For unknown failures or cancellation, say authorization was not completed without asserting that installation is missing.

## Implementation verification

Verified on September 16, 2026 against `carvago-dev` with a development build loaded into Chrome for Testing 153 through Playwright. Auto-login stayed disabled (default). The synthetic nonadmin user from the audit was reactivated on a temporary profile (API access, Lightning Experience, one login IP, session security level `LOW`, no permission to approve uninstalled connected apps). The org requires MFA registration for direct UI logins, so a time-based one-time password authenticator was registered for the synthetic user and used for its browser session. Login As was not used. The connected app stayed **Allowed** and uninstalled for the failure scenarios.

### Commit 1: detection and classification

Implemented behavior:

- `src/content_scripts/mySalesforceContent.js` reports the OAuth error page (`/setup/secur/RemoteAccessErrorPage.apexp`) through `reportOauthErrorPage`, independently of auto-login. Only `error`, `error_description`, and `state` are read.
- `src/background/auth/authFlowController.js` registers an attempt per originating tab and org (`src/background/auth/authAttempts.js`), sends the attempt id as OAuth `state`, and attributes a report only to a single active attempt for the same org. Reports from regular tabs are additionally rejected when they come from the originating tab or from a tab that existed before the attempt started. In Chrome for Testing 153 the `launchWebAuthFlow` window has no `sender.tab`; its content script still reports, and the tab-less origin is accepted.
- `src/shared/authFailure.js` classifies failures: `app_not_installed` only for `invalid_client` with "must be installed", `access_denied`, other `oauth_error` codes, `cancelled` for the generic closed-window error, and `incomplete` otherwise. Confirmed causes recorded from the error page win over Chrome's later generic error. Text is sanitized (URLs, codes, tokens removed, 200 characters max).
- `src/background/auth/auth.js` surfaces OAuth callback errors, `state` mismatches, and token-exchange errors as `AuthFlowError`, and no longer logs the full authorization URL or the callback URL.
- The palette receives `failedAuthFlow` with `{ failure: { attemptId, orgHostname, kind, confirmed, source, salesforceError, message } }` and clears its loading indicator.

E2E evidence (nonadmin, app not installed):

- `Extension > Authorize` opened the OAuth window on `RemoteAccessErrorPage.apexp` with `error=invalid_client` and `error_description=app must be installed into org`. Salesforce did not echo `state` on that page.
- While the page stayed open, the service worker logged the attribution (`kind: app_not_installed`, tab-less origin), the palette had received no failure, and its loading indicator was still visible.
- Closing the window produced the generic closure error; the published failure kept `kind: app_not_installed`, `confirmed: true`, and the loading indicator turned off.
- The same error URL opened manually in a regular tab, with no active attempt, was logged as not attributed.

E2E evidence (administrator, consent page reachable):

- Closing the consent window published `kind: cancelled`, `confirmed: false`, `salesforceError: null`.
- Choosing **Deny** returned `error=access_denied` to the callback and published `kind: access_denied`, `source: oauth_callback`.

Automated tests added: `tests/authFailureClassification.test.js`, `tests/oauthErrorPageDetection.test.js`, `tests/authAttempts.test.js`, `tests/authFlowController.test.js`, `tests/interactiveLoginErrors.test.js`.
