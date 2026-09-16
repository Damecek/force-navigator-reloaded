/**
 * Error raised by the interactive OAuth flow with structured, sanitized detail.
 */
export default class AuthFlowError extends Error {
  /**
   * @param {string} message Sanitized human-readable message without URLs or secrets.
   * @param {Object} detail
   * @param {string} detail.source One of AUTH_FAILURE_SOURCE.
   * @param {string} [detail.error] OAuth error code.
   * @param {string} [detail.errorDescription] OAuth error description.
   */
  constructor(message, { source, error, errorDescription } = {}) {
    super(message);
    this.name = 'AuthFlowError';
    this.source = source;
    this.error = error;
    this.errorDescription = errorDescription;
  }
}
