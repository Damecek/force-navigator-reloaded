import { toCoreHostname } from '../../shared/index.js';

/**
 * @typedef {Object} AuthAttempt
 * @property {string} id Opaque attempt id, also used as the OAuth `state` value.
 * @property {number} tabId Originating Salesforce tab.
 * @property {number|undefined} windowId Window of the originating tab.
 * @property {string} orgHostname Core My Domain hostname of the org being authorized.
 * @property {Set<number>} openTabIds Tabs that already existed when the attempt started.
 * @property {number} startedAt Epoch milliseconds.
 * @property {import('../../shared/authFailure.js').AuthFailure|null} failure Cause recorded before the flow finished.
 */

/**
 * In-memory registry of active interactive authorization attempts.
 *
 * Attempts live only as long as the pending `launchWebAuthFlow` promise, so
 * an in-memory map matches the lifetime of the flow itself.
 */
export default class AuthAttemptRegistry {
  constructor({ now = Date.now, createId = randomId } = {}) {
    this._attempts = new Map();
    this._now = now;
    this._createId = createId;
  }

  /**
   * Register a new attempt for the originating tab.
   * A previous attempt from the same tab is dropped so its late errors are ignored.
   * @param {Object} params
   * @param {number} params.tabId
   * @param {number} [params.windowId]
   * @param {string} params.hostname Any Salesforce hostname of the org.
   * @param {Iterable<number>} [params.openTabIds] Tabs open before the flow started.
   * @returns {AuthAttempt}
   */
  begin({ tabId, windowId, hostname, openTabIds = [] }) {
    for (const attempt of this._attempts.values()) {
      if (attempt.tabId === tabId) {
        this._attempts.delete(attempt.id);
      }
    }
    const attempt = {
      id: this._createId(),
      tabId,
      windowId,
      orgHostname: toCoreHostname(hostname),
      openTabIds: new Set(openTabIds),
      startedAt: this._now(),
      failure: null,
    };
    this._attempts.set(attempt.id, attempt);
    return attempt;
  }

  /**
   * @param {string} id
   * @returns {AuthAttempt|undefined}
   */
  get(id) {
    return this._attempts.get(id);
  }

  /**
   * Whether an attempt is still active.
   * @param {string} id
   * @returns {boolean}
   */
  isActive(id) {
    return this._attempts.has(id);
  }

  /**
   * Find the attempt an OAuth error page belongs to.
   *
   * When Salesforce echoes our `state`, it must match exactly. Otherwise the
   * report is attributed only when the page belongs to the same org and
   * exactly one such attempt is active. Pages loaded in a regular tab must
   * additionally come from a tab that did not exist before the attempt
   * started, that is not the originating tab, and that lives in another
   * window than the originating tab (the auth flow opens its own window).
   * Depending on the Chrome version, the `launchWebAuthFlow` window reports
   * without a tab id; such tab-less reports skip the tab checks.
   * A repeated report of the same error (for example after the error page
   * was reloaded) matches the attempt that already recorded it.
   * @param {Object} report
   * @param {string} report.hostname Hostname of the error page.
   * @param {number|null} [report.tabId] Tab showing the error page, or null for the auth-flow window.
   * @param {number|null} [report.windowId] Window of that tab.
   * @param {string|null} [report.state]
   * @param {string} [report.error] OAuth error code of the report.
   * @returns {AuthAttempt|null}
   */
  findForErrorReport({
    hostname,
    tabId = null,
    windowId = null,
    state = null,
    error,
  }) {
    if (typeof hostname !== 'string' || !hostname) {
      return null;
    }
    const orgHostname = toCoreHostname(hostname);
    const errorCode = typeof error === 'string' ? error.toLowerCase() : null;
    const candidates = [...this._attempts.values()].filter(
      (attempt) =>
        attempt.orgHostname === orgHostname &&
        (attempt.failure === null ||
          (errorCode !== null &&
            attempt.failure.salesforceError?.error === errorCode)) &&
        (typeof tabId !== 'number' ||
          (attempt.tabId !== tabId &&
            !attempt.openTabIds.has(tabId) &&
            (typeof windowId !== 'number' ||
              typeof attempt.windowId !== 'number' ||
              attempt.windowId !== windowId)))
    );
    if (state) {
      return candidates.find((attempt) => attempt.id === state) || null;
    }
    return candidates.length === 1 ? candidates[0] : null;
  }

  /**
   * Record a cause detected before the auth flow settled.
   * @param {string} id
   * @param {import('../../shared/authFailure.js').AuthFailure} failure
   * @returns {AuthAttempt|null}
   */
  recordFailure(id, failure) {
    const attempt = this._attempts.get(id);
    if (!attempt) {
      return null;
    }
    attempt.failure = failure;
    return attempt;
  }

  /**
   * Remove an attempt once the flow has settled.
   * @param {string} id
   * @returns {AuthAttempt|undefined} The removed attempt.
   */
  end(id) {
    const attempt = this._attempts.get(id);
    this._attempts.delete(id);
    return attempt;
  }
}

function randomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
