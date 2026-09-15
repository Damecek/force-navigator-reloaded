/**
 * Build a Lightning component path with a UTF-8 base64 JSON payload.
 * @param {object} payload
 * @returns {string}
 */
export function buildLightningComponentPath(payload) {
  return `/one/one.app#${encodeBase64Utf8(JSON.stringify(payload))}`;
}

/**
 * Encode a UTF-8 string as base64.
 * @param {string} value
 * @returns {string}
 */
function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
