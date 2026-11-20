import { toLightningHostname } from '../../shared/index.js';
import { loadDpopKey } from './dpop/dpopKeyStore.js';
import { createDpopProof, isDpopToken } from './dpop/dpopProof.js';

/** Error code of failures that only a new authorization can resolve. */
export const REAUTHORIZATION_REQUIRED_CODE = 'AUTH_REFRESH_FAILED';

/**
 * Load the signing key of a bound grant from the org's key scope.
 * @param {import('./auth.js').Token} token
 * @returns {Promise<import('./dpop/dpopProof.js').DpopKey|null>}
 */
export function loadGrantKey(token) {
  return loadDpopKey(token.dpop_jkt, toLightningHostname(token.instance_url));
}

/**
 * Build the Authorization headers for one Salesforce request.
 * A bearer grant sends its token; a bound grant sends the DPoP scheme with a
 * fresh proof for this method, URL, and access token. A bound grant is never
 * sent as a bearer token.
 * @param {import('./auth.js').Token} token
 * @param {string} method
 * @param {string} url Request URL; it must belong to the org that issued the token.
 * @returns {Promise<Record<string, string>>}
 * @throws {Error} with `REAUTHORIZATION_REQUIRED_CODE` when the key of a bound grant is missing.
 */
export async function buildAuthorizationHeaders(token, method, url) {
  if (new URL(url).origin !== new URL(token.instance_url).origin) {
    throw new Error('Refusing to send credentials to another origin');
  }
  if (!isDpopToken(token)) {
    return { Authorization: `Bearer ${token.access_token}` };
  }
  const key = await loadGrantKey(token);
  if (!key) {
    const error = new Error(
      'DPoP key is unavailable; authorization is required'
    );
    error.code = REAUTHORIZATION_REQUIRED_CODE;
    throw error;
  }
  return {
    Authorization: `DPoP ${token.access_token}`,
    DPoP: await createDpopProof({
      key,
      method,
      url,
      nonce: token.dpop_nonce,
      accessToken: token.access_token,
    }),
  };
}
