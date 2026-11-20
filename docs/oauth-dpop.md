# OAuth DPoP: design, rollout, and acceptance

The extension supports OAuth 2.0 Demonstrating Proof of Possession ([RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html)) for authorization, token refresh, REST and Tooling API access, My Domain auto-login, and private Login As. This document records the Salesforce behavior the design relies on, the design itself, the rollout plan, and the verification evidence. It continues [OAuth refresh hardening](oauth-refresh-hardening.md).

## Status

- The client is implemented and verified.
- The Dev connected app requires DPoP since November 20, 2026. The setting is not locked. Bearer grants of the Dev app no longer work, and each needs `Extension > Authorize` once per org.
- The Prod connected app still accepts bearer tokens. Salesforce issues bound tokens to a client that asks for them and keeps accepting bearer grants until the app requires DPoP.
- Full compliance with the Salesforce installation requirement needs the rollout steps below, including the separately gated locking step. No compliance is claimed here.
- The Salesforce CLI plugin is unchanged. It uses the authorization of Salesforce CLI, and extension DPoP does not cover CLI-owned grants.

## Salesforce behavior measured on November 17, 2026

Measured with the existing Dev connected app in `carvago-dev` and `carvago-uat`, with **Require DPoP** off. Sources for the expected behavior are the [Salesforce DPoP guide](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_dpop_guide.htm&type=5), the [supported flows and endpoints](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_dpop_supported_flows.htm&type=5), the [UI Bridge API](https://help.salesforce.com/s/articleView?id=xcloud.frontdoor_singleaccess.htm&type=5), and the Mobile SDK 14 [DPoP](https://developer.salesforce.com/docs/platform/mobile-sdk/guide/oauth-dpop.html) and [migration](https://developer.salesforce.com/docs/platform/mobile-sdk/guide/oauth-dpop-migrate.html) guides.

| Area                                     | Observed result                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization                            | `dpop_jkt` on `/services/oauth2/authorize` plus a `DPoP` proof on the code exchange returns `token_type: DPoP`. The same request without them returns `Bearer`. PKCE works unchanged.                                                                                                                                                                                                                                         |
| Algorithm                                | ES256 with a P-256 key in the proof header `jwk` is accepted. The thumbprint is the RFC 7638 SHA-256 of `crv`, `kty`, `x`, `y`.                                                                                                                                                                                                                                                                                               |
| Token endpoint nonce                     | A proof without a valid nonce gets HTTP 400 `use_dpop_nonce` and a `DPoP-Nonce` header. Salesforce sends this before it processes the grant: the same authorization code and the same refresh token succeeded on the repeated request. A successful response carries no new nonce. A still valid nonce is accepted again.                                                                                                     |
| REST and Tooling                         | `Authorization: DPoP <token>` with a proof that contains `htm`, `htu` without query, `ath`, and the token endpoint nonce returns 200.                                                                                                                                                                                                                                                                                         |
| Resource nonce                           | The resource server never sent a nonce challenge. A proof without nonce, with a wrong nonce, wrong key, wrong `htm`, wrong `htu`, missing `ath`, or an `iat` ten minutes old returns 401 `INVALID_AUTH_HEADER` without a `DPoP-Nonce` header.                                                                                                                                                                                 |
| Bound access token as bearer             | 401 `INVALID_SESSION_ID`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Bound refresh token                      | Without a proof or with another key: 400 `invalid_dpop_proof`. The token was not consumed and still worked with its own key.                                                                                                                                                                                                                                                                                                  |
| Bearer refresh token with a proof        | 400 `invalid_request`, "cannot bind an already unbound refresh token". The token was not consumed. A bearer grant cannot be upgraded by a refresh.                                                                                                                                                                                                                                                                            |
| `frontdoor.jsp?sid=<bound access token>` | Shows the login page. No session is created.                                                                                                                                                                                                                                                                                                                                                                                  |
| UI Bridge API                            | `POST /services/oauth2/singleaccess` with the DPoP scheme and proof returns a `frontdoor_uri` with a one-time `otp`. Without the proof, or with the bound token as bearer, it returns 403 `Bad_OAuth_Token`. A bearer grant works with the `Bearer` scheme. `redirect_uri` must be a relative path and may contain a query string, including `/servlet/servlet.su` for Login As. An absolute URL returns 406 `Invalid_Param`. |
| Revocation                               | `/services/oauth2/revoke` accepts a bound refresh token only with a proof.                                                                                                                                                                                                                                                                                                                                                    |
| `ui_sid`                                 | Not present in token responses of this flow. The Mobile SDK reads it only from its hybrid flows.                                                                                                                                                                                                                                                                                                                              |

The Mobile SDK migrates a bearer session by authorizing again through the UI Bridge API, which matches the refused refresh upgrade above. A Chrome extension has no equivalent of that silent web view, so migration here is a new authorization.

## Salesforce behavior with Require DPoP on, measured on November 20, 2026

Measured in `carvago-dev` and `carvago-uat` after the Dev app started to require DPoP.

- The setting reached `carvago-dev` between two and six minutes after the deploy. A bearer authorization made in that gap still returned a `Bearer` token.
- A bearer access token issued before enforcement then returned 401 `INVALID_SESSION_ID` on REST.
- A refresh of that bearer grant without a proof returned 400 `invalid_request` with the description "app requires proof of possession". The response is not `invalid_grant`, so the extension keeps the grant marked as uncertain and asks for authorization.
- A new authorization request without `dpop_jkt` stopped at `/services/oauth2/authorize` with status 400 in both sandboxes. No grant was created.
- Authorization with `dpop_jkt`, refresh, REST and Tooling reads, the UI Bridge, and revocation behaved as measured on November 17.

## Design

Protocol code has no Chrome dependencies. Chrome event wiring stays in `src/background/index.js`.

| Module                                        | Responsibility                                                    |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `src/background/auth/dpop/dpopProof.js`       | Key generation, thumbprint, proof JWT, reading a nonce challenge. |
| `src/background/auth/dpop/dpopKeyStore.js`    | IndexedDB storage of keys, scoped per org.                        |
| `src/background/auth/requestAuthorization.js` | `Authorization` and `DPoP` headers for a grant.                   |
| `src/background/auth/uiSessionBridge.js`      | UI Bridge request for auto-login and Login As.                    |
| `src/background/auth/auth.js`                 | Authorization, token requests, refresh, and the key lifecycle.    |

### Key ownership and lifecycle

A key belongs to one grant: one user's authorization of one org for one OAuth client in one browser profile.

| Dimension                                          | Behavior                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org                                                | Keys are stored under the canonical Lightning hostname. A key stored for another org is not returned, so it cannot sign for this org.                                                                               |
| User                                               | The extension keeps one grant per org and profile. A new authorization replaces the grant and its key.                                                                                                              |
| OAuth client                                       | A bound grant stores the client ID it was issued to. A grant of another client is cleared and needs a new authorization. Dev and Prod builds have different extension IDs and separate storage.                     |
| Chrome profile                                     | IndexedDB and `chrome.storage.local` are per profile and not synced. Another profile authorizes separately and gets its own key.                                                                                    |
| Incognito                                          | The manifest uses the default spanning mode. Incognito tabs talk to the one background worker of the regular profile and share its grants and keys. Login As opens an incognito window and stores nothing there.    |
| Worker suspension, reload, update, browser restart | The key and the token are read from storage for every use. Nothing depends on worker memory. Updates clear only cache entries without the `preserve` flag, and IndexedDB is not touched.                            |
| Interactive authorization                          | The key is generated before the authorization request and kept in memory until the token exchange, like the PKCE verifier. A worker stopped during the OAuth window fails the attempt, as it did before.            |
| Storing a grant                                    | Under the per-org token lock the key is saved first, then the token, then older keys of the org are deleted. When the token cannot be written, the new key is deleted and the previous grant stays intact.          |
| Clearing a grant                                   | The token is removed and the org's keys are deleted.                                                                                                                                                                |
| Key loss or mismatch                               | A bound grant without its key is cleared on the next use without any network request. The palette offers `Extension > Authorize`. A storage error while reading the key is reported and leaves the grant untouched. |
| Uninstall                                          | Chrome deletes the tokens and keys with the extension. The grant on the server ends through revocation or the idle limit.                                                                                           |

### Storage and threat model

- The private key is created with `extractable: false` and stored as a `CryptoKey` object in IndexedDB. This is the least exportable form WebCrypto offers to an extension. Extension code can ask it to sign and cannot read it.
- Tokens stay in `chrome.storage.local`. A bound token copied from there, from a log, or from the network is rejected without a proof from the key.
- No consumer secret exists. The key never reaches `chrome.storage.sync`.
- Not covered: software that controls the browser profile or runs inside the extension can use the key in place, and whoever copies the whole profile directory copies the key store with it. Chrome does not bind the key to hardware.

### Proofs and nonces

- A proof has the header `typ: dpop+jwt`, `alg: ES256`, and the public `jwk`. Its claims are a random 128-bit `jti`, `htm`, `htu` without query and fragment, `iat`, the `nonce` when one is known, and `ath` for resource requests.
- Every token request with a key first sends a proof without a nonce. Salesforce answers with the challenge, and the request is repeated exactly once with the fresh nonce. This costs one extra request per login and per refresh. In return the stored nonce is never older than the access token, which the extension replaces after about 20 hours while Salesforce documents a nonce lifetime of 24 hours.
- The challenge is recognized only when the status is 400, the body error is `use_dpop_nonce`, and the header holds a valid nonce of at most 512 characters. Anything else, including a second challenge, follows the existing handling of a failed token request. The retry therefore never follows a response that could have consumed the refresh token.
- The nonce is stored with the grant and used for API and UI Bridge requests. It is not shared between orgs and not logged.
- The resource server sends no nonce challenge. A request rejected with 401 refreshes the grant once, which also fetches a new nonce, and is repeated once.

### Refresh safety

The protections from the refresh hardening are unchanged: one refresh per canonical hostname across aliases, reuse of a token that replaced a rejected one, the per-org token lock, a newer authorization that an older refresh can neither overwrite nor clear, and the durable `refreshPending` guard that is written before the request and stays after any uncertain outcome.

Added rules:

- A bound grant is refreshed only with a proof from its key. A bearer grant is refreshed without a proof, because Salesforce refuses to bind it.
- A refresh response whose token type differs from the stored grant is rejected and leaves the replay guard in place. A bound grant is never downgraded.
- A bound token is never sent with the `Bearer` scheme. Credentials are refused for a URL outside the org that issued them, and a bound grant stored under another org's hostname is cleared instead of used.
- Token, UI Bridge, REST, and Tooling requests fail on an HTTP redirect, so neither a grant nor a proof is sent on to another URL.
- An authorization that was superseded while it waited for the token lock or the key store writes neither a token nor a key.

### UI sessions

Auto-login and Login As ask the UI Bridge API for a frontdoor URL and open it. Bound grants sign the request. Bearer grants use the same API with the `Bearer` scheme, so the old `frontdoor.jsp?sid=<access token>` URL is gone for every grant. The returned URL must be the frontdoor page of the same org and must not carry a session ID. Redirect paths must be relative and free of backslashes and control characters, including the page that Login As returns to.

Both features need the `web` scope, as before. The extension requests it while one of them is enabled. `WEB_SCOPE_SETTINGS` in `src/shared/settings.js` lists the settings of features that start a UI session, and `isWebScopeRequired()` reads it for the authorization request and for the palette. A new feature of that kind adds the key path of its setting to the list. Login As commands are on by default, so a default installation requests `web`. Before this change the extension requested it only for auto-login, and Login As in a default installation ended at the sign-in page. When the stored grant lacks `web` and a listed feature is on, the palette offers `Extension > Authorize` next to the other commands, and the review prompt stays hidden until the grant has the scope. Because a grant can now carry `web` for Login As alone, the background auto-login handler checks the auto-login setting itself before it touches the grant, in addition to the check in the content script. The options page saves settings from another context, so `isAutologinEnabled()` and `isWebScopeRequired()` read storage on every call. They skip the in-memory copy and write nothing back, because a write of defaults could overwrite a save that happens at the same moment. With a grant that lacks it, `frontdoor.jsp?sid=` showed the login page in version 5.18.0, and the UI Bridge answers `Invalid_Scope` now. For such a grant Login As skips the UI Bridge and opens its Salesforce address in the private window without a session, which keeps the earlier visible behavior. When the UI Bridge fails for a grant that has the scope, nothing is opened and the error is logged.

### Bearer grants and migration

- Existing grants keep the stored format of version 5.18.0 and keep working as bearer grants while the app accepts them.
- A grant becomes bound through `Extension > Authorize`. With an existing Salesforce session and an already approved app this is one command without a consent page.
- When the app requires DPoP, Salesforce rejects bearer grants. The refresh then fails, the grant is cleared or marked uncertain, and the palette offers `Extension > Authorize`. With the Dev app requiring DPoP, the installed extension took this path with a real bearer grant: one refresh without a proof failed, the grant stayed stored with its replay guard, the palette offered `Extension > Authorize` and no org commands, and authorizing stored a bound grant and restored the commands.
- Not implemented: a silent migration that authorizes again without the user. It needs a non-interactive OAuth window whose behavior with Salesforce's scripted redirects is unverified. Decide on it before Prod enforcement if one command per user and org is too much.

## Rollout plan

The Dev app steps were executed on November 20, 2026. Nothing was executed for the Prod app. Enabling **Require DPoP** on an app affects every org and user of that app at once. Locking is irreversible.

### Dev app

The Dev app is used by unpacked development builds only. Its owner org is reached through the CLI alias `force-navigator-connected-app`.

1. Done: the change is merged. Everyone who runs a development build updates it and runs `Extension > Authorize` once per org.
2. Done: the setting is on and not locked. The metadata field is `isDPopEnabled` in `oauthConfig`. It exists in Metadata API 68.0 and not in 64.0, so `sf/sfdx-project.json` now uses 68.0. A deploy of `ConnectedApp:Force_Navigator_Reloaded_Dev` alone changed it, after a validation run. Reading both apps through the Metadata API before and after showed one difference, `isDPopEnabled` from `false` to `true` on the Dev app. The Prod definition was identical.
3. Done: `Force_Navigator_Reloaded_Dev.connectedApp-meta.xml` carries `<isDPopEnabled>true</isDPopEnabled>`.
4. Done by automation in `carvago-dev` and `carvago-uat`, see the installed-extension evidence. The manual acceptance below is still open.
5. Open: confirm in subscriber Insights that proof of possession counts as on. Whether an unlocked setting counts was not read.
6. Roll back by turning the setting off if a regression appears: set `isDPopEnabled` to `false` and deploy the Dev app alone. That works only while the setting is not locked.

`npm run deploy` in `sf` deploys both apps. Use `sf project deploy start -m 'ConnectedApp:Force_Navigator_Reloaded_Dev'` for a Dev-only change.

### Prod app

0. Resolve the idle-expiry mismatch first. On November 20, 2026 the Metadata API 68.0 read `isEnforceRefreshTokenTTL=false` for the Prod app, and subscriber Insights showed its OAuth controls as 2 of 3, while `Force_Navigator_Reloaded_Prod.connectedApp-meta.xml` says `true`. `sf/sfdx-project.json` now uses API 68.0, which knows this field, so `npm run deploy` sends `true` for the Prod app.
1. Release the client first. Confirm that the version with DPoP is publicly available in the Chrome Web Store, then wait at least five full days, as for rotation. A pending review does not start the waiting period.
2. Expect every user whose grant predates the release to be asked for `Extension > Authorize` once per org when DPoP becomes required. Users on an older client cannot authorize at all afterwards, which is why the waiting period matters.
3. Turn on **Require DPoP** on the existing Prod app. Keep the consumer key and callback. Update the Prod metadata file to match a fresh retrieve.
4. Monitor reports. Keep the setting reversible until acceptance and adoption are confirmed.
5. As a separately approved, irreversible step, lock PKCE, refresh token rotation, and proof of possession. An enabled checkbox or a 3/3 count is not evidence of a lock. Verify the locked state of each control in the owner org and in subscriber Insights.

## Verification evidence

Evidence is separated by how it was obtained.

### Unit and integration tests

`npm test` runs 225 tests. The 175 tests that existed before pass, including refresh concurrency, replay protection after lost responses and restarts, storage failures, and protection of a newer authorization.

- `tests/dpopProof.test.js`: proof header, claims, and signature, binding to method, URL, nonce, and access token, unique `jti`, the thumbprint, non-extractable keys, rejection of missing key material, strict reading of nonce challenges, and the key store with org isolation and pruning.
- `tests/authDpop.test.js`: authorization that binds a grant, a bearer answer stored as a bearer grant, key replacement and atomic storage, bound and bearer refresh, eight concurrent callers per org, missing key, key of another org, another client ID, key store failure, refused downgrade, bounded nonce retries, a lost response after a challenge, a stale refresh against a newer authorization, a superseded authorization, a grant stored under another org, signed API requests including pagination and the 401 retry, the origin check, and the UI Bridge for both grant types.
- `tests/webScope.test.js`: the `web` scope is requested by default because Login As is on, by each listed feature on its own, and not when all of them are off. The palette offers authorization for a grant without `web` only while a listed feature is on. Settings saved from another context apply to the next authorization, a check that races a save does not overwrite it, and auto-login does not touch a grant with `web` while its setting is off.

### Live OAuth harness

On November 17, 2026 the actual `auth.js`, `SalesforceConnection`, and `uiSessionBridge.js` ran in Node against Salesforce with the Dev app. The harness replaced Chrome storage, IndexedDB, and the OAuth window, and used the Salesforce CLI session as the signed-in browser. Its keys were extractable so that a second process could load them. The extension itself never creates extractable keys.

Passed in both `carvago-dev` and `carvago-uat`:

- PKCE authorization returned a bound grant after one nonce challenge. REST and Tooling reads returned 200 with the DPoP scheme and a proof.
- Two sequential refreshes rotated and persisted the refresh token. Eight concurrent callers across hostname aliases produced one refresh. After a process restart the stored grant and key worked without a token request, and the next refresh rotated again.
- Negative checks on the test grant only: the bound access token returned 401 as bearer, without a proof, with a proof of another key, and without a nonce. The bound refresh token returned `invalid_dpop_proof` without a proof and with another key, and the grant still refreshed afterwards.
- The auto-login path, one refresh followed by the UI Bridge, started a UI session whose identity page showed the authorized user.
- Sixteen concurrent callers across both orgs refreshed once per org. Each authorized request went to the org that issued its token. A `carvago-dev` token signed with the `carvago-uat` key returned 401, and the key store did not return a key for the other org.

Passed in one org:

- `carvago-uat`: the Login As path through the UI Bridge with a bound grant opened a session whose identity page showed the dedicated test user and not the administrator.
- `carvago-dev`: a bound grant revoked on the server was cleared together with its key. A bearer grant in the 5.18.0 storage format refreshed without a proof, stayed a bearer grant, read REST, and started a UI session through the UI Bridge. Authorizing replaced it with a bound grant. A bound grant whose key was deleted was cleared without any network request, and authorizing restored access.

### Installed extension

The unpacked development build with ID `fjcokiadigpmkojdlhbkbhimkcmjokon` ran in Chrome for Testing 158 with a fresh profile, driven by Playwright. The palette was opened with the message that the keyboard command sends, because browser-level shortcuts cannot be automated. After the last review fixes, these checks were repeated on the final code: the harness login, API, refresh, concurrency, negative, auto-login, restart, and cross-org checks in both sandboxes, the complete installed-extension run in `carvago-dev`, and authorization plus both Login As variants in the installed extension. The remaining results below come from the code before the second round of review fixes. After the `web` scope change and its review fixes, two runs passed on commit `e81e09e`: the complete installed-extension run in `carvago-dev`, including auto-login after logout, and authorization with the default settings followed by Login As in `carvago-uat`.

Passed in both sandboxes:

- `Extension > Authorize` from the palette stored a bound grant. Its key was a `CryptoKey` in IndexedDB with `extractable: false`, and exporting it failed. The token requests carried proofs, and commands loaded.
- After a browser restart the grant and key were usable without a token request.
- Two tabs that refreshed the command list at once, with the access token aged locally, produced one refresh: one challenge and one grant request.
- After an extension reload from `chrome://extensions` the grant and key were unchanged and commands loaded without authorizing again.
- My Domain auto-login after logout: the login form appeared, the tab landed in Lightning, and the identity page showed the authorized user.
- After the grant was revoked, refreshing the command list cleared the grant and key, the palette offered only authorization, and authorizing again restored a bound grant and the commands.

Passed in one sandbox:

- `carvago-uat`: `Administration > Users > <test user> > Login As` opened a private window that landed in Lightning as the dedicated test user. The identity page showed that user and not the administrator.
- `carvago-dev`: starting the profile with a build of a higher version, an extension update, kept the grant and key and reloaded the commands.
- `carvago-uat`, after the `web` scope change: with the default settings, auto-login off and Login As on, `Extension > Authorize` stored a bound grant with the scopes `refresh_token web api`, and the Login As command opened a private window that landed in Lightning as the dedicated test user.
- `carvago-dev`, before the `web` scope change: a grant with the scopes `refresh_token api` and a Login As command opened the private window at the Salesforce sign-in page, and the address carried no session ID or one-time code. Grants from earlier authorizations still take this path.
- `carvago-uat`: a browser process killed during a refresh came back with the grant discarded and without a token request, and the palette offered authorization.

Passed on November 20, 2026 with the Dev app requiring DPoP, on the merged code (`fab6461`):

- `carvago-dev`: the complete list above, from authorization to recovery after revocation.
- `carvago-dev`: a profile that held a real bearer grant ended with `Extension > Authorize` in the palette after one refresh without a proof, and authorizing stored a bound grant and restored the commands.
- `carvago-uat`: with the default settings `Extension > Authorize` stored a bound grant with the scopes `refresh_token web api`, and the Login As command opened a private window that landed in Lightning as the dedicated test user.

### Independent review

Three rounds of independent security review (Open Code Review in delegation mode, GPT-6.2 Astra at high reasoning effort) covered the change. The first two rounds ended with a rejection and a list of findings. The third round accepted commit `9d4cd44` and found no new runtime defect.

The `web` scope change in commit `031ce6f` got its own reviews. The first rejected it with two findings. The background auto-login handler returned a token while auto-login was off, which the wider default scope would have turned into a working session. The background worker could also keep settings from before a change on the options page. The second confirmed the auto-login fix and found that the fresh settings read could write defaults over a save made at the same moment, which the read without a write-back fixes. The third accepted commit `e81e09e` with no open finding. One existing test changed: it turns auto-login on before it expects a token for auto-login.

Fixed and covered by tests:

- Token, UI Bridge, REST, and Tooling requests no longer follow redirects.
- A nonce challenge is accepted only with status 400.
- The UI Bridge refuses a frontdoor URL with a session ID or user info and paths with backslashes or control characters. Its errors carry only a status and an error code, and an unreadable response is reported without its content.
- A bound grant stored under another org is cleared before any refresh branch can return it.
- A superseded authorization is checked again before the token is written.
- Login As falls back to a window without a session only for a grant without the `web` scope.

Left unchanged on purpose:

- A successful refresh response without a new refresh token keeps the previous one. The first round rated this high for rotating apps. The second round accepted it: the worst case is a revoked token family and one more authorization, with no path to another user's grant or to disclosure. The behavior predates this change.
- A failed refresh whose body contains `invalid_grant` clears the grant regardless of the HTTP status. This predates the change.
- REST error messages include the Salesforce error body, and the auto-login log line includes the address of the login page. Production builds strip `console.log`. Both predate the change.
- Login As returns to the current page, including its query string and fragment, as it did before. The second round asked for an allowlist of that route data, and the third round accepted the documented behavior.
- A key that fails to sign leaves the replay guard in place, so the next attempt asks for authorization. That is the intended outcome for an unusable key.

### Not verified

- Behavior with **Require DPoP** turned on for the Prod app. The setting was changed on the Dev app only.
- The subscriber Insights page after the Dev app started to require DPoP.
- The Prod app, the Web Store build, and any org other than the two sandboxes.
- Expiry of a nonce after 24 hours. The recovery through a 401 and a refresh is covered by a unit test only.
- Google Chrome stable with a real keyboard shortcut and a visible OAuth consent page. The test profile had an approved app, so authorization completed without consent.
- More than two concurrent tabs in the installed extension. Higher concurrency passed in the harness.
- Loss of IndexedDB data in a real profile. Key loss passed in the harness.
- Login As with a grant that lacks the `web` scope beyond the opened private window: whether Salesforce continues to the target user after a manual sign-in was not checked.
- Aborted IndexedDB transactions in a real browser. Unit tests use an in-memory replacement.
- The locked state of any control, and a 30-day idle expiry.

### Test side effects

- Salesforce keeps five grants per user and app and drops the least recently used one. The test authorizations dropped five unused test grants from November 9, three in `carvago-dev` and two in `carvago-uat`. Grants in real use were not affected.
- Four bound test grants from November 17 were left on the server because their keys were destroyed before revocation: one in `carvago-dev` and three in `carvago-uat`. A later test authorization in `carvago-uat` dropped one of them as the least recently used grant, so three remain. Nobody can use them. An administrator can revoke them under the user's **OAuth Connected Apps**, or they end with the idle limit.
- All other test grants were revoked individually, including those of November 20. One more unused test grant from November 9 in `carvago-dev` was dropped as the least recently used grant. No grant of another user was touched.
- The only app setting changed is **Require DPoP** on the Dev app, on November 20, 2026. It made every bearer grant of the Dev app unusable, in every org.

## Manual acceptance

Use a development build (`npm run dev-build`, load `dist` unpacked, ID `fjcokiadigpmkojdlhbkbhimkcmjokon`) and an authorized sandbox.

1. Open the org in Lightning, open the palette, and run `Extension > Authorize`. Commands load.
2. In the service worker console, check the grant type and the key without printing secrets:

   ```javascript
   var fnrKey = 'carvago--devas.sandbox.lightning.force.com_sfToken';
   var fnrToken = (await chrome.storage.local.get(fnrKey))[fnrKey].value;
   console.info(
     'token type:',
     fnrToken.token_type,
     'has key id:',
     !!fnrToken.dpop_jkt
   );
   var fnrDb = await new Promise((resolve) => {
     var open = indexedDB.open('forceNavigatorDpop');
     open.onsuccess = () => resolve(open.result);
   });
   var fnrRows = await new Promise((resolve) => {
     var request = fnrDb.transaction('keys').objectStore('keys').getAll();
     request.onsuccess = () => resolve(request.result);
   });
   console.info(fnrRows.map((row) => [row.scope, row.privateKey.extractable]));
   ```

   Expect `DPoP`, `true`, and one row per authorized org with `false`.

3. In the service worker Network panel, a login shows two requests to `/services/oauth2/token`, 400 then 200, both with a `DPoP` request header. API requests carry `Authorization: DPoP ...` and a `DPoP` header.
4. Restart Chrome, then reload the extension on `chrome://extensions`. Each time the palette loads commands without authorizing.
5. Force a refresh as in step 5 of the [refresh hardening acceptance](oauth-refresh-hardening.md#manual-acceptance-carvago-dev) and open the palette in two tabs. One 400 and one 200 token request appear, and the stored refresh token changes.
6. Turn on My Domain auto-login, log out, and open the My Domain login page. The tab lands in Lightning. The address bar shows `frontdoor.jsp?otp=...` on the way and never `sid=`.
7. Run a Login As command. A private window opens as that user. Allow the extension in incognito if Chrome asks for it.
8. Revoke the grant under the user's **OAuth Connected Apps**, run `Extension > Refresh Command List`, and confirm the palette offers `Extension > Authorize`. Authorize and confirm commands load.
9. Bearer transition: in a profile that was authorized with version 5.18.0, install this build over it. Commands keep loading and the stored `token_type` stays `Bearer`. Run `Extension > Authorize` and confirm it becomes `DPoP`.
