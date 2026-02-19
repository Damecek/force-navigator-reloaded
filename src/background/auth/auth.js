/* eslint-disable camelcase */
import {
  CacheManager,
  CLIENT_ID,
  SCOPES,
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
  const authUrl =
    `${loginBase}/services/oauth2/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL('oauth2'))}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&code_challenge=${challenge}&code_challenge_method=S256`;
  console.log('Invoking OAuth2 flow', authUrl);
  try {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
    if (!redirectUrl) {
      const error = new Error(
        'OAuth2 login failed: authorization popup was closed before redirect.'
      );
      error.oauthError = 'authorization_canceled';
      throw error;
    }
    const returnedUrl = new URL(redirectUrl);
    console.log('OAuth2 redirect URL', redirectUrl);
    const oauthError = returnedUrl.searchParams.get('error');
    if (oauthError) {
      const oauthErrorDescription =
        returnedUrl.searchParams.get('error_description') ||
        'OAuth authorization failed';
      const error = new Error(
        `OAuth2 login failed: ${oauthError} (${oauthErrorDescription})`
      );
      error.oauthError = oauthError;
      error.oauthErrorDescription = oauthErrorDescription;
      error.oauthRedirectUrl = returnedUrl.toString();
      throw error;
    }
    const code = returnedUrl.searchParams.get('code');
    if (!code) {
      throw new Error(
        'OAuth2 login failed: no code received. Received instead: ' +
          returnedUrl
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
    await storeToken(token);
    return token;
  } catch (error) {
    console.log('OAuth2 login failed:', error);
    throw error;
  }
}

/**
 * Ensures a valid access token, refreshes if needed or returns null
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
  console.log('Token expired, refreshing...');
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
  await storeToken(fresh);
  return fresh;
}

function storeToken(token) {
  token.issued_at = Date.now();
  const cache = new CacheManager(toLightningHostname(token.instance_url));
  return cache.set(SF_TOKEN_CACHE_KEY, token, { preserve: true });
}
