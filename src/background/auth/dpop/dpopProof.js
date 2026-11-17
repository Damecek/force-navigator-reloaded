import { b64url } from '../authUtil.js';

/**
 * OAuth 2.0 DPoP (RFC 9449) proof generation for Salesforce.
 * Pure protocol code: no Chrome APIs, storage, or network access.
 */

const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' };
const NONCE_PATTERN = /^[\x21\x23-\x5B\x5D-\x7E]{1,512}$/;
const NONCE_ERROR = 'use_dpop_nonce';
export const DPOP_TOKEN_TYPE = 'DPoP';

/**
 * @typedef {Object} DpopKey
 * @property {CryptoKey} privateKey Non-extractable ES256 signing key.
 * @property {{crv: string, kty: string, x: string, y: string}} publicJwk
 * @property {string} thumbprint RFC 7638 SHA-256 thumbprint, sent as `dpop_jkt`.
 */

/**
 * Generate an ES256 key pair whose private key cannot be exported.
 * @returns {Promise<DpopKey>}
 */
export async function generateDpopKey() {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    KEY_ALGORITHM,
    false,
    ['sign']
  );
  const { crv, kty, x, y } = await crypto.subtle.exportKey('jwk', publicKey);
  const publicJwk = { crv, kty, x, y };
  return {
    privateKey,
    publicJwk,
    thumbprint: await computeJwkThumbprint(publicJwk),
  };
}

/**
 * RFC 7638 thumbprint of an EC public key: required members in lexicographic order.
 * @param {{crv: string, kty: string, x: string, y: string}} publicJwk
 * @returns {Promise<string>}
 */
export async function computeJwkThumbprint({ crv, kty, x, y }) {
  return sha256Base64Url(JSON.stringify({ crv, kty, x, y }));
}

/**
 * `htu` claim: the request URL without query and fragment.
 * @param {string} url
 * @returns {string}
 */
export function normalizeHtu(url) {
  const { origin, pathname } = new URL(url);
  return `${origin}${pathname}`;
}

/**
 * Create a signed DPoP proof JWT for one request.
 * @param {Object} options
 * @param {DpopKey} options.key
 * @param {string} options.method HTTP method of the request.
 * @param {string} options.url Request URL; query and fragment are not signed.
 * @param {string} [options.nonce] Server nonce from the token endpoint.
 * @param {string} [options.accessToken] Bound access token for resource requests, hashed into `ath`.
 * @returns {Promise<string>}
 */
export async function createDpopProof({
  key,
  method,
  url,
  nonce,
  accessToken,
}) {
  if (!key?.privateKey || !key.publicJwk) {
    throw new Error('DPoP key is unavailable');
  }
  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: key.publicJwk };
  const payload = {
    jti: b64url(crypto.getRandomValues(new Uint8Array(16))),
    htm: method.toUpperCase(),
    htu: normalizeHtu(url),
    iat: Math.floor(Date.now() / 1000),
  };
  if (nonce) {
    payload.nonce = nonce;
  }
  if (accessToken) {
    payload.ath = await sha256Base64Url(accessToken);
  }
  const signingInput = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const signature = await crypto.subtle.sign(
    SIGN_ALGORITHM,
    key.privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${b64url(signature)}`;
}

/**
 * Read the nonce from a token endpoint `use_dpop_nonce` challenge (HTTP 400).
 * Salesforce rejects the proof before it processes the grant, so the request
 * can be repeated once. Every other response returns null and keeps its
 * normal handling.
 * @param {Response} response
 * @returns {Promise<string|null>}
 */
export async function readDpopNonceChallenge(response) {
  if (response.status !== 400) {
    return null;
  }
  const nonce = response.headers?.get('DPoP-Nonce');
  if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) {
    return null;
  }
  try {
    const body = await response.clone().json();
    return body?.error === NONCE_ERROR ? nonce : null;
  } catch {
    return null;
  }
}

/**
 * @param {{token_type?: string}|null|undefined} token
 * @returns {boolean} Whether Salesforce bound the token to a DPoP key.
 */
export function isDpopToken(token) {
  return (
    typeof token?.token_type === 'string' &&
    token.token_type.toLowerCase() === DPOP_TOKEN_TYPE.toLowerCase()
  );
}

/**
 * @param {object} value
 * @returns {string}
 */
function encodeSegment(value) {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * @param {string} value
 * @returns {Promise<string>}
 */
async function sha256Base64Url(value) {
  return b64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  );
}
