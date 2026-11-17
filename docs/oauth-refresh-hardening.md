# OAuth refresh hardening: rotation and idle TTL

First iteration of OAuth hardening for the extension. It keeps the existing global connected apps and consumer keys. It
adds no proof-of-possession (DPoP), no External Client App, and no new auth backend. DPoP followed as a separate
change and is described in [OAuth DPoP: design, rollout, and acceptance](oauth-dpop.md).

## What changed

- `src/background/auth/auth.js` runs one refresh per canonical Lightning hostname. Aliases such as
  `*.my.salesforce.com` and `*.my.salesforce-setup.com` share the same refresh.
- A caller that got 401 passes the rejected access token. If the stored token already differs, the caller reuses it
  without a token request.
- Token reads and writes for one org are serialized. A refresh result (success or `invalid_grant`) is discarded when an
  interactive authorization stored newer credentials in the meantime.
- A persistent `refreshPending` flag is written before sending the refresh request. Network errors, unreadable
  responses, server errors, interrupted workers, and failed writes of rotated credentials leave that flag in place.
  The submitted token is never retried. The next attempt discards the uncertain grant and offers
  `Extension > Authorize`. A newer interactive login is preserved and returned even when the older request fails.
  If the pre-dispatch guard cannot be stored, no request is sent.
- A refresh response without `refresh_token` keeps the previous one, so the Prod app without rotation keeps working.
- `ensureWebScopedToken` (My Domain auto-login) refreshes exactly once instead of up to twice.
- Development logs no longer print cached token values, the `Authorization` header, or the frontdoor URL with `sid`.
- The Dev and Prod Connected App metadata now have `isRefreshTokenRotationEnabled` and `isEnforceRefreshTokenTTL` set to `true`, with `refreshTokenPolicy=specific_inactivity:30:DAYS`. Prod was activated only after the client rollout waiting period described below.

The idle TTL is enforced by Salesforce. It is a sliding 30-day window that resets on every refresh. It is not an
absolute 30-day lifetime and not the access-token session timeout (`sessionTimeout` stays 1440 minutes). The extension
does not refresh in the background only to keep an unused org alive.

## Rollout

1. Dev app (owner org): turn on refresh token rotation and **Limit Idle Refresh Token Time-to-Live (TTL) to 30 Days** in
   the existing app's OAuth policies, matching the Dev metadata file. Edit the existing app. Do not create a second app
   or a new consumer key. The setting applies to every org that uses the Dev app, not only to `carvago-dev`.
2. Run the manual acceptance below against `carvago-dev` with a development build.
3. Release the client to the Chrome Web Store. Confirm that the hardened version is publicly available to all users, then wait at least five full days for users to update. Upload success or a pending store review does not start this waiting period. Defer activation if publication is incomplete or a regression is reported.
4. Prod app: apply the same two settings, then update `Force_Navigator_Reloaded_Prod.connectedApp-meta.xml` to match.

### Production activation on November 15, 2026

- Chrome Web Store version 5.18.0 was first confirmed publicly available on November 10 at 09:00:31 UTC. The activation check on November 15 confirmed that the public listing still showed 5.18.0 and that more than 120 hours had elapsed. The release tag points to `99bc96184fb5579554023b9ceafb895021fae12c`.
- Owner org `00DgL000004HUsEUAW`, authenticated through `force-navigator-connected-app`, owns the existing `Force_Navigator_Reloaded_Prod` app. Before modification, a fresh metadata retrieve matched its consumer key, callback, label, and PKCE requirement to the source. No new app or consumer key was created.
- Rotation was enabled through the existing app's Setup page. The idle TTL enforcement checkbox was already checked, disabled, and described by Salesforce as a required setting. It was preserved. The app's OAuth policy was explicitly saved as **Expire refresh token if not used for 30 Day(s)**.
- Reopening the app's edit page confirmed rotation, TTL enforcement, and PKCE enabled. Comparing all checkbox states before and after showed only rotation changed. The saved policy page confirmed **Idle Expiration Time Limit Enforced** and 30 days. IP relaxation, self-authorization, and the 24-hour session timeout were preserved.
- A fresh metadata retrieve after saving independently confirmed `isRefreshTokenRotationEnabled=true` and `refreshTokenPolicy=specific_inactivity:30:DAYS`. Comparing the complete retrieved Prod definition before and after found only those two changes; all other retrieved fields, including the consumer key and callback, were unchanged. The Dev definition was unchanged. Metadata omitted `isEnforceRefreshTokenTTL` for both apps, so enforcement verification relies on the reopened owner UI rather than an assumed API value.
- Subscriber propagation was not confirmed: the `carvago-dev` Insights page showed the Dev app with OAuth controls 3/3, but did not show a Prod app row during this check. No additional app installation or authorization was performed just to obtain subscriber evidence.
- Actual 30-day wall-clock expiration and full proof-of-possession compliance remain outside this verification. No user grants were broadly revoked.

Older clients that still run when rotation is turned on can refresh twice in parallel. Salesforce then revokes the token
family, and the user sees `Extension > Authorize`. This is why Prod waits for the client update.

Salesforce references:

- [Refresh token rotation](https://help.salesforce.com/s/articleView?id=005316711&language=en_US&type=1)
- [Limit the idle refresh token TTL](https://help.salesforce.com/s/articleView?id=xcloud.connected_app_limit_idle_ttl.htm&language=en_US&type=5)

## Verification coverage

Unit tests (`tests/authRefreshConcurrency.test.js`, `tests/authRefresh.test.js`) cover:

- parallel refreshes across hostname aliases send one token request,
- different orgs refresh independently,
- a late 401 reuses the stored token, including a delayed response on a connection that already refreshed, and a 401 with the current token refreshes,
- three parallel 401 responses on one connection rotate once and retry with the new token,
- a stale `invalid_grant` and a stale success do not replace a newer interactive authorization,
- lost responses and worker restarts never resubmit a potentially consumed refresh token,
- a failed pre-dispatch write sends no request, and a failed post-rotation write retains the replay guard,
- an older failed refresh returns newer interactive credentials,
- a new authorization is not blocked by an earlier failure,
- My Domain auto-login refreshes once,
- the existing non-rotating fallback, `invalid_grant`, and conservative server-error recovery.

Unit tests do not prove the Salesforce side: rotation responses, family revocation, and the idle TTL need the live
connected-app settings. Nobody has observed a 30-day idle expiry. The manual steps check revocation recovery instead.

## Current verification evidence

- Local tests: 175 passed, including a regression for a delayed 401 response on the same connection. Lint and the development build passed after that fix.
- The existing Dev consumer key was recognized by Salesforce. A real consent and PKCE exchange for **Force Navigator Reloaded Dev** in `carvago-dev` subsequently succeeded during live acceptance. Its placeholder-like name is not evidence that it is invalid.
- On November 4, 2026, the existing Dev app was updated through Setup in its owner org, authenticated under CLI alias `force-navigator-connected-app`. Rotation and **Limit Idle Refresh Token Time-to-Live (TTL) to 30 Days** were enabled. The owner policy was saved as **Expire refresh token if not used for 30 Day(s)**.
- A fresh owner-org metadata retrieve confirmed `isRefreshTokenRotationEnabled=true`, `isEnforceRefreshTokenTTL=true`, and `refreshTokenPolicy=specific_inactivity:30:DAYS`. The Dev consumer key and callback were preserved. The retrieved Prod definition was byte-for-byte identical before and after the change.
- Subscriber propagation completed without reinstalling the app. At 08:41 UTC on November 4, 2026, `carvago-dev` Insights reported OAuth controls **3/3**: rotation, PKCE, and TTL on. Proof-of-possession remained **0/1**, as expected for this iteration.
- Live acceptance exercised the actual `auth.js` against Salesforce with a test grant. Four refresh requests succeeded: two sequential requests, one shared by eight concurrent callers, and one after a process restart. Sequential and restart refreshes returned and persisted replacement refresh tokens. `SalesforceConnection` REST and Tooling reads both returned HTTP 200. The test-only access token was revoked with HTTP 200, private credential artifacts were deleted, and test browser tabs were closed.
- On November 9, 2026, independent Astra acceptance passed in both `carvago-dev` and `carvago-uat` using the actual `auth.js` and `SalesforceConnection`: PKCE, two sequential rotations with persisted replacements, eight concurrent callers sharing one refresh per org, refresh after a process restart, and REST/Tooling HTTP 200 before and after restart. Revoking each isolated test refresh token caused a failed refresh and cleared its cache. Sixteen concurrent calls across both orgs produced exactly one refresh per org without overwriting the other org's credentials.
- Installed Dev extension UI acceptance subsequently passed in both sandbox orgs: palette command loading and navigation, use in two tabs after refreshing commands, extension reload without reauthorization, My Domain AutoLogin with identity verification, and private Login As with identity verification. Login As required a grant containing the `web` scope; after enabling AutoLogin, the reauthorization prompt appeared after refreshing the command list.
- Forced concurrent refresh and revocation followed by recovery through the palette remain unverified in the installed UI. Their OAuth implementation paths passed the live harness. No 30-day wall-clock idle expiry was observed.
- The isolated UI test profile was left with AutoLogin and incognito access off and its window closed. Its Dev and UAT test grants remain active because individual grants could not be safely identified for cleanup; no broad revocation was performed. No production app settings were changed during acceptance.

## Manual acceptance (`carvago-dev`)

Prerequisite: the Dev app settings from rollout step 1 are active.

1. Run `npm run dev-build`. In `chrome://extensions`, load `dist` unpacked and confirm the ID is
   `fjcokiadigpmkojdlhbkbhimkcmjokon`.
2. Open `carvago-dev` in Lightning, open the palette, and run `Extension > Authorize`. Choose **Allow**. The commands
   load.
3. Open the service worker DevTools. Copy the first 12 characters of the stored `access_token` (they start with the org
   ID `00D`). Search the console output for them, for `Bearer`, and for `sid=`. No match should appear.
4. Open four or five `carvago-dev` tabs at once and run `Extension > Refresh Command List` in two of them. Commands load in all tabs.
   In the Network panel of the service worker, each refresh burst shows at most one `/services/oauth2/token` request.
5. Force a refresh: in the service worker console, set the stored token's `issued_at` to a value more than 20 hours ago,
   then open the palette in two tabs at once. One token request appears, and the stored `refresh_token` value changes
   (compare locally using equality or hashes, without printing or copying tokens).
   In the extension service worker console, this ages only the local access-token timestamp and records a hash for comparison without printing a token:

   ```javascript
   var fnrKey = 'carvago--devas.sandbox.lightning.force.com_sfToken';
   var fnrEntry = (await chrome.storage.local.get(fnrKey))[fnrKey];
   if (!fnrEntry?.value?.refresh_token)
     throw new Error('Authorize carvago-dev first');
   var fnrHash = async (value) =>
     Array.from(
       new Uint8Array(
         await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
       )
     )
       .map((byte) => byte.toString(16).padStart(2, '0'))
       .join('');
   var fnrBefore = await fnrHash(fnrEntry.value.refresh_token);
   fnrEntry.value.issued_at = Date.now() - 21 * 60 * 60 * 1000;
   await chrome.storage.local.set({ [fnrKey]: fnrEntry });
   ```

   After loading the palette in both tabs, compare the stored refresh-token hash locally:

   ```javascript
   console.info(
     'Refresh token rotated:',
     fnrBefore !==
       (await fnrHash(
         (await chrome.storage.local.get(fnrKey))[fnrKey].value.refresh_token
       ))
   );
   ```

   This checks rotation after activation; changing a local timestamp does not test Salesforce's 30-day idle policy.

6. Restart Chrome. Open the palette. Commands load without authorizing again.
7. Turn on My Domain auto-login in Settings, run `Extension > Authorize` again so the token has the `web` scope, log
   out, and open the My Domain login page. The browser lands in Lightning without a login form.
8. Run a Login As command for a user. An incognito window opens, logged in as that user.
9. Revoke the extension's OAuth token in Setup (**Connected Apps OAuth Usage** or the user's **OAuth Connected Apps**).
   Open the palette. It offers `Extension > Authorize`. Authorize again and confirm commands load.
10. Optional: set the service worker Network panel to Offline, force a refresh using step 5, then restore connectivity.
    The uncertain grant must not be retried. Run `Extension > Authorize` and confirm commands load again.

## Remaining gap

This iteration left tokens as bearer tokens in `chrome.storage.local`. Rotation shortens how long a stolen refresh
token stays usable once the extension refreshes, and the idle TTL ends unused grants. A stolen bearer access token
still works until its session expires.

The client now supports proof-of-possession: new authorizations are bound to a key, and auto-login and Login As no
longer put the access token into a frontdoor URL. See [OAuth DPoP: design, rollout, and acceptance](oauth-dpop.md).
Grants issued before that change stay bearer grants until the user authorizes again, and neither app requires DPoP
yet, so full compliance with the Salesforce Insights recommendation is still open.
