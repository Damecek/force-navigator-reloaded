import { toLightningUrl, toCoreUrl } from '../navigator/urls.js';
export {
  toLightningHostname,
  toLightningUrl,
  toCoreHostname,
  toCoreUrl,
  toSetupUrl,
} from '../navigator/urls.js';
export { buildLightningUrl } from '../navigator/setupUrl.js';
import {
  CONTENT_SCRIPT_DISABLED_BASE_DOMAINS,
  CONTENT_SCRIPT_ENABLED_BASE_DOMAINS,
} from './constants.js';

/**
 * Build Salesforce frontdoor URL with destination to Lightning home.
 * @param {string} orgHostname
 * @param {string} sid
 * @param {string} [retURL='/lightning/page/home']
 * @returns {string}
 */
export function buildFrontdoorUrl(
  orgHostname,
  sid,
  retURL = '/lightning/page/home'
) {
  const query = new URLSearchParams({ sid, retURL });
  return `${toCoreUrl(orgHostname)}/secur/frontdoor.jsp?${query.toString()}`;
}

/**
 * Build a Lightning one.app URL with a base64-encoded JSON payload.
 * @param {string} orgHostname
 * @param {object} payload
 * @returns {string}
 */
export function buildLightningComponentUrl(orgHostname, payload) {
  const encodedPayload = encodeBase64Utf8(JSON.stringify(payload));
  return `${toLightningUrl(orgHostname)}/one/one.app#${encodedPayload}`;
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

/**
 * Checks if the given URL's hostname ends with one of the allowed base domains.
 * @param {string} urlString The URL to check.
 * @returns {boolean} True if the hostname matches an allowed base domain.
 */
export function isContentScriptAllowedDomain(urlString) {
  return isEnabledDomain(
    urlString,
    CONTENT_SCRIPT_ENABLED_BASE_DOMAINS,
    CONTENT_SCRIPT_DISABLED_BASE_DOMAINS
  );
}

function isEnabledDomain(urlString, enabledDomains, disabledDomains) {
  try {
    const hostname = new URL(urlString).hostname;
    return enabledDomains.some(
      (domain) =>
        hostname.endsWith(domain) && !hostname.endsWith(disabledDomains)
    );
  } catch {
    return false;
  }
}
