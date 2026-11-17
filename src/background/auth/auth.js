/* eslint-disable camelcase */
import {
  CacheManager,
  CLIENT_ID,
  isAutologinEnabled,
  SF_TOKEN_CACHE_KEY,
  toCoreUrl,
  toLightningHostname,
  toLightningUrl,
} from '../../shared/index.js';
import { makePkcePair } from './authUtil.js';
import AuthFlowError from './authFlowError.js';
import {
  deleteDpopKey,
  pruneDpopKeys,
  saveDpopKey,
} from './dpop/dpopKeyStore.js';
import {
  createDpopProof,
  generateDpopKey,
  isDpopToken,
  readDpopNonceChallenge,
} from './dpop/dpopProof.js';
import { loadGrantKey } from './requestAuthorization.js';
import {
  AUTH_FAILURE_SOURCE,
  sanitizeAuthErrorText,
} from '../../shared/authFailure.js';

/**
 * @typedef {Object} Token
 * @property {string} access_token
 * @property {string} id
 * @property {string} id_token
 * @property {string} instance_url
 * @property {number} issued_at
 * @property {string} refresh_token
 * @property {string} scope
 * @property {string} signature
 * @property {boolean} [refreshPending] Durable guard against replay after an interrupted refresh.
 * @property {string} token_type `DPoP` for a grant bound to a key, otherwise `Bearer`.
 * @property {string} [dpop_jkt] Thumbprint of the key a bound grant was issued for.
 * @property {string} [dpop_nonce] Latest server nonce for proofs of a bound grant.
 * @property {string} [client_id] OAuth client that a bound grant was issued to.
 */

/**
 * Launches interactive OAuth2-PKCE flow and stores token.
 * The request offers a new DPoP key; Salesforce binds the grant to it and
 * answers with token type `DPoP`. A `Bearer` answer is stored as a bearer grant.
 * @param {string} hostname Any Salesforce hostname of the org.
 * @param {Object} [options]
 * @param {string} [options.state] Opaque value echoed by Salesforce, used to correlate the attempt.
 * @param {() => boolean} [options.shouldPersist] Consulted right before the token is stored; a superseded attempt returns false and its token is discarded.
 * @returns {Promise<Token>} token object
 * @throws {AuthFlowError} when Salesforce, the OAuth callback, or the token exchange reports an error.
 */
export async function interactiveLogin(
  hostname,
  { state, shouldPersist } = {}
) {
  const { verifier, challenge } = await makePkcePair();
  const dpopKey = await generateDpopKey();
  const loginBase = toLightningUrl(hostname);
  const scopes = await buildOauthScopes();
  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    dpop_jkt: dpopKey.thumbprint,
  });
  if (state) {
    authParams.set('state', state);
  }
  const authUrl = `${loginBase}/services/oauth2/authorize?${authParams.toString()}`;
  console.log('Invoking OAuth2 flow', { hostname, loginBase, scopes, state });
  let redirectUrl;
  try {
    redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
  } catch (error) {
    throw new AuthFlowError(
      sanitizeAuthErrorText(error?.message) || 'OAuth window closed',
      {
        source: AUTH_FAILURE_SOURCE.IDENTITY_API,
      }
    );
  }
  const code = parseAuthorizationCode(redirectUrl, state);

  const tokenBase = toCoreUrl(hostname);
  const tokenEndpoint = `${tokenBase}/services/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const { response: resp, nonce } = await postTokenRequest(
    tokenEndpoint,
    params,
    dpopKey
  );
  if (!resp.ok) {
    throw buildTokenExchangeError(await resp.text());
  }
  const token = await resp.json();
  console.log('OAuth2 token response', {
    hostname,
    instance_url: token?.instance_url,
    scope: token?.scope,
    token_type: token?.token_type,
  });
  if (typeof shouldPersist === 'function' && !shouldPersist()) {
    console.log('OAuth2 attempt superseded, discarding its token');
    return token;
  }
  await storeToken(token, dpopKey, nonce, shouldPersist);
  return token;
}

/**
 * POST a grant to the token endpoint. A request with a DPoP key first sends a
 * proof without a nonce. Salesforce answers with a `use_dpop_nonce` challenge
 * before it processes the grant, and the request is repeated once with that
 * fresh nonce. No other response is retried, and a redirect fails the request
 * so the grant is never sent to another URL.
 * @param {string} tokenEndpoint
 * @param {URLSearchParams} params
 * @param {import('./dpop/dpopProof.js').DpopKey|null} dpopKey
 * @returns {Promise<{response: Response, nonce: string|null}>}
 */
async function postTokenRequest(tokenEndpoint, params, dpopKey) {
  const send = async (nonce) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (dpopKey) {
      headers.DPoP = await createDpopProof({
        key: dpopKey,
        method: 'POST',
        url: tokenEndpoint,
        nonce,
      });
    }
    return fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body: params.toString(),
      redirect: 'error',
    });
  };
  const response = await send();
  const nonce = dpopKey ? await readDpopNonceChallenge(response) : null;
  return nonce
    ? { response: await send(nonce), nonce }
    : { response, nonce: null };
}

/**
 * Extract the authorization code from the OAuth callback URL.
 * Errors returned by Salesforce on the callback are surfaced as structured failures.
 * @param {string|undefined} redirectUrl
 * @param {string|undefined} expectedState
 * @returns {string}
 * @throws {AuthFlowError}
 */
function parseAuthorizationCode(redirectUrl, expectedState) {
  let returnedUrl;
  try {
    returnedUrl = new URL(redirectUrl);
  } catch {
    throw new AuthFlowError('OAuth2 login failed: no callback URL received', {
      source: AUTH_FAILURE_SOURCE.OAUTH_CALLBACK,
    });
  }
  const params = returnedUrl.searchParams;
  console.log('OAuth2 callback received', {
    hasCode: params.has('code'),
    error: params.get('error'),
    hasState: params.has('state'),
  });
  if (expectedState && params.get('state') !== expectedState) {
    throw new AuthFlowError('OAuth2 login failed: state mismatch', {
      source: AUTH_FAILURE_SOURCE.OAUTH_CALLBACK,
      error: 'state_mismatch',
    });
  }
  const error = params.get('error');
  if (error) {
    throw new AuthFlowError(
      `OAuth2 login failed: ${sanitizeAuthErrorText(error)}`,
      {
        source: AUTH_FAILURE_SOURCE.OAUTH_CALLBACK,
        error,
        errorDescription: params.get('error_description') || '',
      }
    );
  }
  const code = params.get('code');
  if (!code) {
    throw new AuthFlowError('OAuth2 login failed: no code received', {
      source: AUTH_FAILURE_SOURCE.OAUTH_CALLBACK,
    });
  }
  return code;
}

/**
 * Build a structured error from the token endpoint response body.
 * @param {string} body
 * @returns {AuthFlowError}
 */
function buildTokenExchangeError(body) {
  let error;
  let errorDescription;
  try {
    const parsed = JSON.parse(body);
    error = parsed?.error;
    errorDescription = parsed?.error_description;
  } catch {
    errorDescription = body;
  }
  return new AuthFlowError(
    `Token request failed: ${sanitizeAuthErrorText(error || errorDescription)}`,
    {
      source: AUTH_FAILURE_SOURCE.TOKEN_EXCHANGE,
      error,
      errorDescription,
    }
  );
}

/**
 * Ensures token is ready for My Domain auto-login flow.
 * Always exchanges the refresh token once so frontdoor receives a fresh UI session,
 * and never launches interactive OAuth from the passive auto-login flow.
 *
 * @param {string} hostname
 * @returns {Promise<Token|null>}
 */
export async function ensureWebScopedToken(hostname) {
  const cachedToken = await new CacheManager(toLightningHostname(hostname)).get(
    SF_TOKEN_CACHE_KEY
  );
  console.log('ensureWebScopedToken: cached token', {
    hostname,
    hasToken: !!cachedToken,
  });
  if (!cachedToken) {
    return null;
  }
  const token = await refreshToken(hostname);
  if (!token) {
    console.log(
      'ensureWebScopedToken: token refresh failed, cannot use stale token for auto-login'
    );
    return null;
  }
  const autologinEnabled = await isAutologinEnabled();
  if (autologinEnabled && !tokenHasScope(token, 'web')) {
    console.log(
      'Auto-login requires web scope. Skipping passive auto-login without interactive OAuth.'
    );
    return null;
  }
  return token;
}

/**
 * Ensures a valid access token, refreshes if needed or returns null
 * @param {string} hostname
 * @returns {Promise<Token|null>}
 */
export async function ensureToken(hostname) {
  const loginBase = toLightningHostname(hostname);
  console.log('Ensuring token for', loginBase);
  const cache = new CacheManager(loginBase);
  const cachedToken = await cache.get(SF_TOKEN_CACHE_KEY);
  if (!cachedToken) {
    return null;
  }
  if (!(await resolveGrantKey(cachedToken, loginBase)).usable) {
    console.log('Bound grant has no usable key; authorization is required');
    return clearTokenIfUnchanged(loginBase, cachedToken);
  }
  const refreshTime = 3600 * 1000 * 24; // defined in Force_Navigator_Reloaded_xxx.connectedApp-meta.xml
  const grace = 3600 * 1000 * 4; // 4 hours grace period
  if (
    !cachedToken.refreshPending &&
    Date.now() - cachedToken.issued_at < refreshTime - grace
  ) {
    return cachedToken;
  }
  return refreshToken(hostname);
}

/** @type {Map<string, Promise<Token|null>>} */
const refreshesInFlight = new Map();
/** @type {Map<string, Promise<void>>} */
const tokenLocks = new Map();

/**
 * Exchanges the cached refresh token for a new access token.
 * One refresh runs per canonical Lightning hostname; concurrent callers share it.
 * A caller that received 401 passes the rejected access token, so a token stored
 * by another refresh or login in the meantime is reused instead of rotating again.
 * Returns null and clears the cache only when the stored grant is unusable.
 * @param {string} hostname
 * @param {Object} [options]
 * @param {string} [options.rejectedAccessToken] Access token that Salesforce rejected.
 * @returns {Promise<Token|null>}
 */
export function refreshToken(hostname, { rejectedAccessToken } = {}) {
  const loginBase = toLightningHostname(hostname);
  const inFlight = refreshesInFlight.get(loginBase);
  if (inFlight) {
    return inFlight;
  }
  const refresh = runRefresh(loginBase, rejectedAccessToken).finally(() => {
    if (refreshesInFlight.get(loginBase) === refresh) {
      refreshesInFlight.delete(loginBase);
    }
  });
  refreshesInFlight.set(loginBase, refresh);
  return refresh;
}

/**
 * @param {string} loginBase Canonical Lightning hostname.
 * @param {string} [rejectedAccessToken]
 * @returns {Promise<Token|null>}
 */
async function runRefresh(loginBase, rejectedAccessToken) {
  const cache = new CacheManager(loginBase);
  const cachedToken = await cache.get(SF_TOKEN_CACHE_KEY);
  if (cachedToken?.refreshPending) {
    console.log('Interrupted refresh requires authorization for', loginBase);
    return clearTokenIfUnchanged(loginBase, cachedToken);
  }
  const { usable, dpopKey } = await resolveGrantKey(cachedToken, loginBase);
  if (!usable) {
    console.log('Bound grant has no usable key; authorization is required');
    return clearTokenIfUnchanged(loginBase, cachedToken);
  }
  if (
    cachedToken &&
    rejectedAccessToken &&
    cachedToken.access_token !== rejectedAccessToken
  ) {
    console.log('Token already replaced, reusing stored token for', loginBase);
    return cachedToken;
  }
  if (!cachedToken?.refresh_token) {
    console.log(
      'Token refresh unavailable. Missing refresh token, deleting cached token for',
      loginBase
    );
    return clearTokenIfUnchanged(loginBase, cachedToken);
  }
  const prepared = await withTokenLock(loginBase, async () => {
    const current = await cache.get(SF_TOKEN_CACHE_KEY);
    if (!isSameGrant(current, cachedToken)) {
      return { dispatch: false, token: current };
    }
    try {
      await cache.set(
        SF_TOKEN_CACHE_KEY,
        {
          ...cachedToken,
          refreshPending: true,
        },
        { preserve: true }
      );
      return { dispatch: true };
    } catch {
      console.log('Cannot persist refresh replay guard; skipping request');
      return { dispatch: false, token: null };
    }
  });
  if (!prepared.dispatch) {
    return prepared.token;
  }

  console.log('Refreshing Salesforce token for', loginBase);
  const outcome = await requestTokenRefresh(cachedToken, dpopKey);
  if (outcome.invalidGrant) {
    console.log(
      'Token refresh failed with invalid_grant. Refresh token is revoked or expired, clearing cached token.'
    );
    return clearTokenIfUnchanged(loginBase, cachedToken);
  }
  if (!outcome.token) {
    console.log('Refresh outcome is uncertain; authorization is required.', {
      error: outcome.error,
    });
    return withTokenLock(loginBase, async () => {
      const current = await cache.get(SF_TOKEN_CACHE_KEY);
      return isSameGrant(current, cachedToken) ? null : current;
    });
  }

  const fresh = outcome.token;
  fresh.refresh_token = fresh.refresh_token || cachedToken.refresh_token;
  fresh.scope = fresh.scope || cachedToken.scope;
  if (dpopKey) {
    fresh.dpop_jkt = cachedToken.dpop_jkt;
    fresh.dpop_nonce = outcome.nonce || cachedToken.dpop_nonce;
    fresh.client_id = cachedToken.client_id;
  }
  console.log('OAuth2 refresh response', {
    instance_url: fresh?.instance_url,
    scope: fresh?.scope,
    rotated: fresh.refresh_token !== cachedToken.refresh_token,
  });
  return withTokenLock(loginBase, async () => {
    const current = await cache.get(SF_TOKEN_CACHE_KEY);
    if (!isSameGrant(current, cachedToken)) {
      console.log('Newer credentials stored during refresh, discarding result');
      return current;
    }
    fresh.issued_at = Date.now();
    try {
      await cache.set(SF_TOKEN_CACHE_KEY, fresh, { preserve: true });
      return fresh;
    } catch {
      console.log(
        'Cannot persist rotated credentials; authorization is required'
      );
      return null;
    }
  });
}

/**
 * Calls the token endpoint with the refresh token grant.
 * A bound grant proves possession of its key; a bearer grant sends no proof,
 * because Salesforce refuses to bind an existing bearer refresh token.
 * Errors and unreadable responses leave the durable replay guard in place.
 * A response whose token type differs from the stored grant is rejected, so a
 * bound grant is never downgraded.
 * @param {Token} cachedToken
 * @param {import('./dpop/dpopProof.js').DpopKey|null} dpopKey Key of a bound grant.
 * @returns {Promise<{token?: Token, nonce?: string|null, invalidGrant?: boolean, error?: string}>}
 */
async function requestTokenRefresh(cachedToken, dpopKey) {
  const tokenEndpoint = `${cachedToken.instance_url.replace(/\/+$/, '')}/services/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: cachedToken.refresh_token,
  });
  try {
    const { response: resp, nonce } = await postTokenRequest(
      tokenEndpoint,
      params,
      dpopKey
    );
    if (!resp.ok) {
      const errorBody = await resp.text();
      const { error } = buildTokenExchangeError(errorBody);
      return {
        invalidGrant:
          error === 'invalid_grant' || errorBody.includes('invalid_grant'),
        error: error || `http_${resp.status}`,
      };
    }
    const token = await resp.json();
    if (!token?.access_token || !token?.instance_url) {
      return { error: 'invalid_token_response' };
    }
    if (isDpopToken(token) !== !!dpopKey) {
      return { error: 'unexpected_token_type' };
    }
    return { token, nonce };
  } catch {
    return { error: 'request_failed' };
  }
}

/**
 * Clears the stored token unless a newer grant replaced the snapshot.
 * @param {string} loginBase
 * @param {Token|null} snapshot Token the caller based its decision on.
 * @returns {Promise<Token|null>} The newer token, or null after clearing.
 */
function clearTokenIfUnchanged(loginBase, snapshot) {
  return withTokenLock(loginBase, async () => {
    const cache = new CacheManager(loginBase);
    const current = await cache.get(SF_TOKEN_CACHE_KEY);
    if (current && !isSameGrant(current, snapshot)) {
      console.log('Newer credentials stored meanwhile, keeping them');
      return current;
    }
    await cache.clear(SF_TOKEN_CACHE_KEY);
    await pruneOrgKeys(loginBase, null);
    return null;
  });
}

/**
 * Resolve the signing key of a stored grant.
 * A bearer grant needs none. A bound grant is unusable when its key is missing
 * from this browser profile, it was issued to another OAuth client, or it is
 * stored under an org other than the one that issued it.
 * @param {Token|null} token
 * @param {string} loginBase Canonical Lightning hostname the grant is stored under.
 * @returns {Promise<{usable: boolean, dpopKey: import('./dpop/dpopProof.js').DpopKey|null}>}
 */
async function resolveGrantKey(token, loginBase) {
  if (!isDpopToken(token)) {
    return { usable: true, dpopKey: null };
  }
  if (
    token.client_id !== CLIENT_ID ||
    toLightningHostname(token.instance_url) !== loginBase
  ) {
    return { usable: false, dpopKey: null };
  }
  const dpopKey = await loadGrantKey(token);
  return { usable: !!dpopKey, dpopKey };
}

/**
 * Delete keys of an org that its stored grant no longer uses.
 * A failure leaves an unused key behind and never blocks the token change.
 * @param {string} loginBase
 * @param {string|null} keepThumbprint
 * @returns {Promise<void>}
 */
async function pruneOrgKeys(loginBase, keepThumbprint) {
  try {
    await pruneDpopKeys(loginBase, keepThumbprint);
  } catch {
    console.log('Cannot prune unused DPoP keys for', loginBase);
  }
}

/**
 * @param {Token|null} a
 * @param {Token|null} b
 * @returns {boolean} Whether both tokens are the same stored credentials.
 */
function isSameGrant(a, b) {
  return (
    !!a &&
    !!b &&
    a.access_token === b.access_token &&
    a.refresh_token === b.refresh_token
  );
}

/**
 * Serializes token writes and guarded read-modify-write operations for one org.
 * @template T
 * @param {string} loginBase
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
function withTokenLock(loginBase, task) {
  const previous = tokenLocks.get(loginBase) || Promise.resolve();
  const run = previous.then(task);
  const tail = run.then(
    () => {},
    () => {}
  );
  tokenLocks.set(loginBase, tail);
  tail.then(() => {
    if (tokenLocks.get(loginBase) === tail) {
      tokenLocks.delete(loginBase);
    }
  });
  return run;
}

/**
 * Builds OAuth scopes based on extension settings.
 * @returns {Promise<string>}
 */
async function buildOauthScopes() {
  const autologinEnabled = await isAutologinEnabled();
  return autologinEnabled ? 'web api refresh_token' : 'api refresh_token';
}

/**
 * Returns whether a token contains a given OAuth scope.
 * @param {Token} token
 * @param {string} scope
 * @returns {boolean}
 */
export function tokenHasScope(token, scope) {
  const scopes = (token?.scope || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return scopes.includes(scope);
}

/**
 * Delete the key of a grant that could not be stored. A failure is ignored
 * because the key is unreferenced and is pruned with the next token change.
 * @param {string} thumbprint
 * @returns {Promise<void>}
 */
async function discardKey(thumbprint) {
  try {
    await deleteDpopKey(thumbprint);
  } catch {
    console.log('Cannot delete an unused DPoP key');
  }
}

/**
 * Persist a token under the org's Lightning hostname with the current issue time.
 * A bound grant stores its key first, so a stored `DPoP` token always has a
 * key; the key is removed again when the token cannot be written. Keys of
 * replaced grants are deleted afterwards. An attempt that was superseded
 * while it waited for the lock or the key store writes nothing.
 * @param {Token} token
 * @param {import('./dpop/dpopProof.js').DpopKey} dpopKey Key offered in the authorization request.
 * @param {string|null} nonce Nonce from the token endpoint challenge.
 * @param {() => boolean} [shouldPersist] Consulted again right before the token write.
 * @returns {Promise<void>}
 */
function storeToken(token, dpopKey, nonce, shouldPersist) {
  token.issued_at = Date.now();
  const loginBase = toLightningHostname(token.instance_url);
  const bound = isDpopToken(token);
  if (bound) {
    token.dpop_jkt = dpopKey.thumbprint;
    token.dpop_nonce = nonce;
    token.client_id = CLIENT_ID;
  }
  return withTokenLock(loginBase, async () => {
    if (bound) {
      await saveDpopKey(loginBase, dpopKey);
    }
    if (typeof shouldPersist === 'function' && !shouldPersist()) {
      console.log('OAuth2 attempt superseded, discarding its token');
      if (bound) {
        await discardKey(dpopKey.thumbprint);
      }
      return;
    }
    try {
      await new CacheManager(loginBase).set(SF_TOKEN_CACHE_KEY, token, {
        preserve: true,
      });
    } catch (error) {
      if (bound) {
        await discardKey(dpopKey.thumbprint);
      }
      throw error;
    }
    await pruneOrgKeys(loginBase, bound ? dpopKey.thumbprint : null);
  });
}
