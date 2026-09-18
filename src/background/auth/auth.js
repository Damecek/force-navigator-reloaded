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
 * @property {string} token_type
 */

/**
 * Launches interactive OAuth2-PKCE flow and stores token.
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
  const resp = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) {
    throw buildTokenExchangeError(await resp.text());
  }
  const token = await resp.json();
  console.log('OAuth2 token response', {
    hostname,
    instance_url: token?.instance_url,
    scope: token?.scope,
  });
  if (typeof shouldPersist === 'function' && !shouldPersist()) {
    console.log('OAuth2 attempt superseded, discarding its token');
    return token;
  }
  await storeToken(token);
  return token;
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
 * Returns existing token when it already has `web` scope.
 * Never launches interactive OAuth from passive auto-login flow.
 *
 * @param {string} hostname
 * @returns {Promise<Token|null>}
 */
export async function ensureWebScopedToken(hostname) {
  let token = await ensureToken(hostname);
  console.log('ensureWebScopedToken: ensured token', {
    hostname,
    hasToken: !!token,
    instance_url: token?.instance_url,
    scope: token?.scope,
  });
  if (!token) {
    return null;
  }
  const refreshedToken = await refreshToken(hostname);
  if (!refreshedToken) {
    console.log(
      'ensureWebScopedToken: token refresh failed, cannot use stale token for auto-login'
    );
    return null;
  }
  token = refreshedToken;
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
  const refreshTime = 3600 * 1000 * 24; // defined in Force_Navigator_Reloaded_xxx.connectedApp-meta.xml
  const grace = 3600 * 1000 * 4; // 4 hours grace period
  if (Date.now() - cachedToken.issued_at < refreshTime - grace) {
    return cachedToken;
  }
  return refreshToken(hostname);
}

/**
 * Force refreshes cached token for the provided Salesforce hostname.
 * Returns null and clears cache only when refresh is not possible.
 * @param {string} hostname
 * @returns {Promise<Token|null>}
 */
export async function refreshToken(hostname) {
  const loginBase = toLightningHostname(hostname);
  const cache = new CacheManager(loginBase);
  const cachedToken = await cache.get(SF_TOKEN_CACHE_KEY);
  if (!cachedToken?.refresh_token) {
    console.log(
      'Token refresh unavailable. Missing refresh token, deleting cached token for',
      loginBase
    );
    await cache.clear(SF_TOKEN_CACHE_KEY);
    return null;
  }

  console.log('Refreshing Salesforce token for', loginBase);
  const tokenEndpoint = `${cachedToken.instance_url.replace(/\/+$/, '')}/services/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: cachedToken.refresh_token,
  });
  const resp = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) {
    const errorBody = await resp.text();
    const isInvalidGrant = errorBody.includes('invalid_grant');
    if (isInvalidGrant) {
      console.log(
        'Token refresh failed with invalid_grant. Refresh token is permanently revoked, clearing cached token.',
        errorBody
      );
      await cache.clear(SF_TOKEN_CACHE_KEY);
    } else {
      console.log(
        'Token refresh failed. Preserving cached token for retry.',
        errorBody
      );
    }
    return null;
  }

  const fresh = await resp.json();
  fresh.refresh_token = fresh.refresh_token || cachedToken.refresh_token;
  fresh.scope = fresh.scope || cachedToken.scope;
  console.log('OAuth2 refresh response', {
    cached_instance_url: cachedToken?.instance_url,
    fresh_instance_url: fresh?.instance_url,
    fresh_scope: fresh?.scope,
  });
  await storeToken(fresh);
  return fresh;
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
 * Persist a token under the org's Lightning hostname with the current issue time.
 * @param {Token} token
 * @returns {Promise<void>}
 */
function storeToken(token) {
  token.issued_at = Date.now();
  const cache = new CacheManager(toLightningHostname(token.instance_url));
  return cache.set(SF_TOKEN_CACHE_KEY, token, { preserve: true });
}
