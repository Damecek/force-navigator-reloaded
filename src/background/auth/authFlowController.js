import {
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_FAILED_AUTH_FLOW,
  CHANNEL_INVOKE_AUTH_FLOW,
  CHANNEL_REPORT_OAUTH_ERROR_PAGE,
  AUTH_FAILURE_SOURCE,
  classifyAuthFailure,
  selectAuthFailure,
} from '../../shared/index.js';
import AuthAttemptRegistry from './authAttempts.js';
import { interactiveLogin } from './auth.js';

/**
 * @typedef {Object} AuthFailurePayload
 * @property {string} attemptId
 * @property {string} orgHostname Core My Domain hostname of the org.
 * @property {string} kind
 * @property {boolean} confirmed
 * @property {string} source
 * @property {import('../../shared/authFailure.js').SalesforceOauthError|null} salesforceError
 * @property {string} message
 */

/**
 * Wire the interactive authorization flow: start attempts, correlate
 * Salesforce OAuth error pages with them, and publish structured results to
 * the originating tab.
 * @param {Object} [deps]
 * @param {AuthAttemptRegistry} [deps.registry]
 * @param {typeof interactiveLogin} [deps.login]
 * @param {(attempt: import('./authAttempts.js').AuthAttempt, failure: import('../../shared/authFailure.js').AuthFailure, senderTabId: number|null) => (void|Promise<void>)} [deps.onErrorPageAttributed] Defaults to publishing the failure to the originating tab immediately.
 * @returns {{ registry: AuthAttemptRegistry }}
 */
export function registerAuthFlowListeners({
  registry = new AuthAttemptRegistry(),
  login = interactiveLogin,
  onErrorPageAttributed = publishEarlyFailure,
} = {}) {
  new Channel(CHANNEL_INVOKE_AUTH_FLOW).subscribe(async ({ sender }) => {
    const tabId = sender?.tab?.id;
    const hostname = getSenderHostname(sender);
    if (typeof tabId !== 'number' || !hostname) {
      console.error('Auth flow ignored: missing sender tab or hostname');
      return;
    }
    const attempt = registry.begin({
      tabId,
      windowId: sender.tab.windowId,
      hostname,
      openTabIds: await listOpenTabIds(),
    });
    try {
      await login(hostname, {
        state: attempt.id,
        shouldPersist: () => registry.isActive(attempt.id),
      });
      if (!registry.isActive(attempt.id)) {
        console.log('Auth flow superseded, skipping completion publish');
        return;
      }
      registry.end(attempt.id);
      await new Channel(CHANNEL_COMPLETED_AUTH_FLOW).publish({
        data: { attemptId: attempt.id, orgHostname: attempt.orgHostname },
        tabId,
      });
    } catch (error) {
      const terminal = classifyAuthFailure({
        error: error?.error,
        errorDescription: error?.errorDescription,
        source: error?.source || AUTH_FAILURE_SOURCE.UNKNOWN,
        message: error?.message,
      });
      const current = registry.end(attempt.id);
      if (!current) {
        console.log('Auth flow superseded, skipping failure publish');
        return;
      }
      const failure = selectAuthFailure(current.failure, terminal);
      console.error('Auth flow failed', {
        kind: failure.kind,
        source: failure.source,
        salesforceError: failure.salesforceError,
      });
      await new Channel(CHANNEL_FAILED_AUTH_FLOW).publish({
        data: { failure: toPayload(attempt, failure) },
        tabId,
      });
    }
  });

  new Channel(CHANNEL_REPORT_OAUTH_ERROR_PAGE).subscribe(
    async ({ data, sender }) => {
      const hostname = getSenderHostname(sender);
      if (!hostname || !data?.error) {
        return null;
      }
      const reportTabId =
        typeof sender?.tab?.id === 'number' ? sender.tab.id : null;
      const attempt = registry.findForErrorReport({
        hostname,
        tabId: reportTabId,
        windowId:
          typeof sender?.tab?.windowId === 'number'
            ? sender.tab.windowId
            : null,
        state: typeof data.state === 'string' ? data.state : null,
        error: data.error,
      });
      if (!attempt) {
        console.log('OAuth error page not attributed to an active attempt', {
          fromTab: reportTabId !== null,
        });
        return null;
      }
      const failure = classifyAuthFailure({
        error: data.error,
        errorDescription: data.errorDescription,
        source: AUTH_FAILURE_SOURCE.SALESFORCE_ERROR_PAGE,
      });
      registry.recordFailure(attempt.id, failure);
      console.log('OAuth error page attributed to attempt', {
        attemptId: attempt.id,
        kind: failure.kind,
        fromTab: reportTabId !== null,
      });
      const payload = toPayload(attempt, failure);
      await onErrorPageAttributed(attempt, failure, reportTabId);
      return payload;
    },
    { respond: true }
  );

  return { registry };
}

/**
 * Notify the originating tab as soon as the cause is known, while the OAuth
 * window is still open. The later terminal publish repeats the same attempt
 * id, which the palette deduplicates.
 * @param {import('./authAttempts.js').AuthAttempt} attempt
 * @param {import('../../shared/authFailure.js').AuthFailure} failure
 * @returns {Promise<void>}
 */
async function publishEarlyFailure(attempt, failure) {
  await new Channel(CHANNEL_FAILED_AUTH_FLOW).publish({
    data: { failure: toPayload(attempt, failure) },
    tabId: attempt.tabId,
  });
}

/**
 * Build the sanitized payload published to the originating tab.
 * @param {import('./authAttempts.js').AuthAttempt} attempt
 * @param {import('../../shared/authFailure.js').AuthFailure} failure
 * @returns {AuthFailurePayload}
 */
export function toPayload(attempt, failure) {
  return {
    attemptId: attempt.id,
    orgHostname: attempt.orgHostname,
    kind: failure.kind,
    confirmed: failure.confirmed,
    source: failure.source,
    salesforceError: failure.salesforceError,
    message: failure.message,
  };
}

/**
 * Ids of all tabs open right now, used to recognize tabs created by the auth flow.
 * @returns {Promise<number[]>}
 */
async function listOpenTabIds() {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs.map((tab) => tab.id).filter((id) => typeof id === 'number');
  } catch (error) {
    console.error('Failed to list open tabs', error);
    return [];
  }
}

/**
 * Hostname of the document that sent the message. Falls back to the sender
 * URL because the `launchWebAuthFlow` window has no tab.
 * @param {chrome.runtime.MessageSender} sender
 * @returns {string|null}
 */
function getSenderHostname(sender) {
  const url = sender?.tab?.url || sender?.url;
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}
