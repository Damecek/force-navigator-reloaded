/**
 * Classification of extension authorization failures.
 *
 * The module is pure so it can be shared by the background service worker,
 * content scripts, and the command palette without Chrome API access.
 */

export const AUTH_FAILURE_KIND = Object.freeze({
  APP_NOT_INSTALLED: 'app_not_installed',
  ACCESS_DENIED: 'access_denied',
  OAUTH_ERROR: 'oauth_error',
  CANCELLED: 'cancelled',
  INCOMPLETE: 'incomplete',
});

export const AUTH_FAILURE_SOURCE = Object.freeze({
  SALESFORCE_ERROR_PAGE: 'salesforce_error_page',
  OAUTH_CALLBACK: 'oauth_callback',
  TOKEN_EXCHANGE: 'token_exchange',
  IDENTITY_API: 'identity_api',
  UNKNOWN: 'unknown',
});

const MAX_TEXT_LENGTH = 200;
const APP_NOT_INSTALLED_PATTERN = /must be installed/i;
const CANCELLED_PATTERN =
  /did not approve access|user cancel|user canceled|user cancelled|window closed|closed by the user/i;

/**
 * @typedef {Object} SalesforceOauthError
 * @property {string} error OAuth error code, for example `invalid_client`.
 * @property {string} description Sanitized `error_description`, or an empty string.
 */

/**
 * @typedef {Object} AuthFailure
 * @property {string} kind One of {@link AUTH_FAILURE_KIND}.
 * @property {boolean} confirmed Whether Salesforce or the OAuth callback reported a concrete cause.
 * @property {string} source One of {@link AUTH_FAILURE_SOURCE}.
 * @property {SalesforceOauthError|null} salesforceError Original OAuth error when one was reported.
 * @property {string} message Sanitized technical detail for logs and diagnostics.
 */

/**
 * Remove URLs, credentials, and excessive length from diagnostic text.
 * @param {unknown} text
 * @returns {string}
 */
export function sanitizeAuthErrorText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(
      /\b(code|access_token|refresh_token|id_token|sid|client_id|code_verifier|code_challenge)=[^&\s]*/gi,
      '$1=[redacted]'
    )
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > MAX_TEXT_LENGTH
    ? `${cleaned.slice(0, MAX_TEXT_LENGTH - 1)}…`
    : cleaned;
}

/**
 * Classify a raw authorization failure into a structured, sanitized failure.
 * @param {Object} input
 * @param {string} [input.error] OAuth `error` parameter when Salesforce reported one.
 * @param {string} [input.errorDescription] OAuth `error_description` parameter.
 * @param {string} [input.source] One of {@link AUTH_FAILURE_SOURCE}.
 * @param {string} [input.message] Free-form error message, for example from `chrome.identity`.
 * @returns {AuthFailure}
 */
export function classifyAuthFailure({
  error,
  errorDescription,
  source = AUTH_FAILURE_SOURCE.UNKNOWN,
  message,
} = {}) {
  const errorCode = sanitizeAuthErrorText(error).toLowerCase();
  const description = sanitizeAuthErrorText(errorDescription);
  const detail = sanitizeAuthErrorText(message);
  const salesforceError = errorCode ? { error: errorCode, description } : null;

  if (
    errorCode === 'invalid_client' &&
    APP_NOT_INSTALLED_PATTERN.test(description)
  ) {
    return build(
      AUTH_FAILURE_KIND.APP_NOT_INSTALLED,
      true,
      source,
      salesforceError,
      detail
    );
  }
  if (errorCode === 'access_denied') {
    return build(
      AUTH_FAILURE_KIND.ACCESS_DENIED,
      true,
      source,
      salesforceError,
      detail
    );
  }
  if (errorCode) {
    return build(
      AUTH_FAILURE_KIND.OAUTH_ERROR,
      true,
      source,
      salesforceError,
      detail
    );
  }
  if (source === AUTH_FAILURE_SOURCE.TOKEN_EXCHANGE) {
    return build(AUTH_FAILURE_KIND.OAUTH_ERROR, true, source, null, detail);
  }
  if (CANCELLED_PATTERN.test(detail)) {
    return build(AUTH_FAILURE_KIND.CANCELLED, false, source, null, detail);
  }
  return build(AUTH_FAILURE_KIND.INCOMPLETE, false, source, null, detail);
}

/**
 * Choose the failure to report when both a recorded cause and the terminal
 * error of the auth flow exist. A confirmed cause recorded earlier (for
 * example from the Salesforce error page) wins over Chrome's generic error
 * emitted when the OAuth window is closed afterwards.
 * @param {AuthFailure|null|undefined} recorded
 * @param {AuthFailure} terminal
 * @returns {AuthFailure}
 */
export function selectAuthFailure(recorded, terminal) {
  if (recorded?.confirmed) {
    return recorded;
  }
  if (terminal?.confirmed) {
    return terminal;
  }
  return recorded || terminal;
}

/**
 * Whether the failure describes a concrete cause that can be explained to the user.
 * @param {AuthFailure|null|undefined} failure
 * @returns {boolean}
 */
export function isConfirmedAuthFailure(failure) {
  return failure?.confirmed === true;
}

/**
 * Assemble the failure object.
 * @param {string} kind
 * @param {boolean} confirmed
 * @param {string} source
 * @param {SalesforceOauthError|null} salesforceError
 * @param {string} message
 * @returns {AuthFailure}
 */
function build(kind, confirmed, source, salesforceError, message) {
  return { kind, confirmed, source, salesforceError, message };
}
