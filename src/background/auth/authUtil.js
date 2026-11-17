/**
 * Base64-url-encode binary data without padding.
 * @param {ArrayBuffer|Uint8Array} buf
 * @returns {string}
 */
export function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) {
    str += String.fromCharCode(b);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a PKCE code verifier and challenge
 * @returns {Promise<{verifier:string, challenge:string}>}
 */
export async function makePkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  const challenge = b64url(hash);
  return { verifier, challenge };
}
