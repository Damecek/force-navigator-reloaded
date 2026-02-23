/* eslint-disable camelcase */
import {
  CacheManager,
  CLIENT_ID,
  isAutologinEnabled,
  SF_TOKEN_CACHE_KEY,
  toCoreUrl,
  toLightningHostname,
  toLightningUrl,
} from '../../shared';
import { makePkcePair } from './authUtil';

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
 * Launches interactive OAuth2-PKCE flow and stores token
 * @returns {Promise<Token>} token object
 */
export async function interactiveLogin(hostname) {
  const { verifier, challenge } = await makePkcePair();
  const loginBase = toLightningUrl(hostname);
  const scopes = await buildOauthScopes();
  const authUrl =
    `${loginBase}/services/oauth2/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL('oauth2'))}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&code_challenge=${challenge}&code_challenge_method=S256`;
  console.log('Invoking OAuth2 flow', { hostname, loginBase, scopes, authUrl });
  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  const returnedUrl = new URL(redirectUrl);
  console.log('OAuth2 redirect URL', redirectUrl);
  const code = returnedUrl.searchParams.get('code');
  if (!code) {
    throw new Error(
      'OAuth2 login failed: no code received. Received instead: ' + returnedUrl
    );
  }

  const tokenBase = toCoreUrl(hostname);
  const tokenEndpoint = `${tokenBase}/services/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: chrome.identity.getRedirectURL('oauth2'),
    code_verifier: verifier,
  });
  const resp = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) {
    throw new Error(`Token request failed: ${await resp.text()}`);
  }
  const token = await resp.json();
  console.log('OAuth2 token response', {
    hostname,
    instance_url: token?.instance_url,
    scope: token?.scope,
  });
  await storeToken(token);
  return token;
}

/**
 * Ensures token is ready for My Domain auto-login flow.
 * Returns existing token when it already has `web` scope, otherwise
 * performs interactive login to request required scopes.
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
  if (refreshedToken) {
    token = refreshedToken;
  }
  const autologinEnabled = await isAutologinEnabled();
  if (autologinEnabled && !tokenHasScope(token, 'web')) {
    console.log(
      'Auto-login requires web scope. Starting interactive OAuth to re-authorize scopes.'
    );
    token = await interactiveLogin(hostname);
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
 * Returns null and clears cache when refresh is not possible or fails.
 * @param {string} hostname
 * @returns {Promise<Token|null>}
 */
export async function refreshToken(hostname) {
  const loginBase = toLightningHostname(hostname);
  const cache = new CacheManager(loginBase);
  const cachedToken = await cache.get(SF_TOKEN_CACHE_KEY);
  if (!cachedToken?.refresh_token) {
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
    console.log('Token refresh failed.', await resp.text());
    await cache.clear(SF_TOKEN_CACHE_KEY);
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
function tokenHasScope(token, scope) {
  const scopes = (token?.scope || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return scopes.includes(scope);
}

function storeToken(token) {
  token.issued_at = Date.now();
  const cache = new CacheManager(toLightningHostname(token.instance_url));
  return cache.set(SF_TOKEN_CACHE_KEY, token, { preserve: true });
}
