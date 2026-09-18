import { SALESFORCE_OAUTH_ERROR_PAGE_PATH } from '../shared/constants.js';

/**
 * @typedef {Object} OauthErrorPageReport
 * @property {string} error OAuth `error` query parameter.
 * @property {string} errorDescription OAuth `error_description` query parameter, or an empty string.
 * @property {string|null} state OAuth `state` query parameter when Salesforce echoed it.
 */

/**
 * Parse the Salesforce OAuth error page (`RemoteAccessErrorPage.apexp`).
 * Only the OAuth error fields are read; the rest of the URL is ignored.
 * @param {Location|URL} location
 * @returns {OauthErrorPageReport|null} Null when the page is not a Salesforce OAuth error page.
 */
export function parseOauthErrorPage(location = window.location) {
  const pathname = (location?.pathname || '').toLowerCase();
  if (!pathname.endsWith(SALESFORCE_OAUTH_ERROR_PAGE_PATH.toLowerCase())) {
    return null;
  }
  const params = new URLSearchParams(location.search || '');
  const error = params.get('error');
  if (!error) {
    return null;
  }
  return {
    error,
    errorDescription: params.get('error_description') || '',
    state: params.get('state') || null,
  };
}
