import {
  AUTH_HELP_README_URL,
  describeAuthFailure,
  EXTENSION_DISPLAY_NAME,
} from '../../../../../shared/index.js';
import {
  dismissLightningToasts,
  showLightningToast,
} from '../../../../../content_scripts/lightningToastBridge.js';
import {
  dismissFallbackNotice,
  showFallbackNotice,
} from '../../../../../content_scripts/fallbackNotice.js';
import { armAuthHelpLink } from '../../../../../content_scripts/authHelpLink.js';

export const AUTH_HELP_LABEL = 'Open authorization help';
export const AUTH_SUCCESS_TITLE = `${EXTENSION_DISPLAY_NAME} is authorized`;
const SUCCESS_DURATION_MS = 6000;

/**
 * @typedef {Object} AuthFeedbackDeps
 * @property {(request: import('../../../../../content_scripts/lightningToastBridge').ToastRequest) => boolean} [showToast]
 * @property {(titles?: string[]) => boolean} [dismissToasts]
 * @property {(params: object) => unknown} [showFallback]
 * @property {() => void} [dismissFallback]
 * @property {() => void} [openHelp] Opens the extension help page.
 * @property {(callback: () => void) => void} [scheduleAfterDismiss] Defers a new toast until the host closed the previous one.
 * @property {() => void} [armHelpLink] Permits one page-context help-link click to open the extension help.
 */

const DISMISS_SETTLE_MS = 400;

/**
 * Build the toast request for an authorization failure.
 * @param {import('../../../../../background/auth/authFlowController.js').AuthFailurePayload} failure
 * @returns {import('../../../../../content_scripts/lightningToastBridge').ToastRequest}
 */
export function buildAuthFailureToast(failure) {
  const copy = describeAuthFailure(failure);
  return {
    title: copy.title,
    message: copy.adminSteps
      ? `${copy.message} ${copy.adminSteps}`
      : copy.message,
    variant: 'error',
    mode: 'sticky',
    helpLabel: AUTH_HELP_LABEL,
    helpUrl: AUTH_HELP_README_URL,
  };
}

/**
 * Build the toast request confirming a completed authorization.
 * @returns {import('../../../../../content_scripts/lightningToastBridge').ToastRequest}
 */
export function buildAuthSuccessToast() {
  return {
    title: AUTH_SUCCESS_TITLE,
    message:
      'Salesforce confirmed access for this org. The command palette is loading its commands and is ready to use.',
    variant: 'success',
    mode: 'dismissible',
    duration: SUCCESS_DURATION_MS,
  };
}

/**
 * Create the authorization feedback presenter for the originating tab.
 * It shows one notification per authorization attempt, prefers the native
 * Salesforce toast, and falls back to an accessible notice when the host
 * toast mechanism is unavailable.
 * @param {AuthFeedbackDeps} [deps]
 */
export function createAuthFeedback({
  showToast = showLightningToast,
  dismissToasts = dismissLightningToasts,
  showFallback = showFallbackNotice,
  dismissFallback = dismissFallbackNotice,
  openHelp,
  scheduleAfterDismiss = (callback) => setTimeout(callback, DISMISS_SETTLE_MS),
  armHelpLink = armAuthHelpLink,
} = {}) {
  const notifiedAttempts = new Set();
  const shownTitles = new Set();
  let generation = 0;

  /**
   * Show a request natively or through the fallback notice.
   * @param {import('../../../../../content_scripts/lightningToastBridge').ToastRequest} request
   * @returns {'toast'|'fallback'}
   */
  function present(request) {
    shownTitles.add(request.title);
    if (showToast(request)) {
      if (request.helpUrl) {
        armHelpLink();
      }
      return 'toast';
    }
    showFallback({
      title: request.title,
      message: request.message,
      variant: request.variant,
      helpLabel: request.helpLabel,
      helpUrl: request.helpUrl,
      duration: request.mode === 'sticky' ? undefined : request.duration,
      onHelpClick:
        typeof openHelp === 'function'
          ? (event) => {
              event.preventDefault();
              openHelp();
            }
          : undefined,
    });
    return 'fallback';
  }

  /**
   * Present now, or after the previous toast closed. A request that is no
   * longer the latest when its turn comes is dropped.
   * @param {import('../../../../../content_scripts/lightningToastBridge').ToastRequest} request
   * @param {boolean} mustWait
   * @returns {'toast'|'fallback'|'scheduled'}
   */
  function presentLatest(request, mustWait) {
    const requestGeneration = ++generation;
    if (!mustWait) {
      return present(request);
    }
    scheduleAfterDismiss(() => {
      if (requestGeneration === generation) {
        present(request);
      }
    });
    return 'scheduled';
  }

  return {
    /**
     * Show feedback for a failed authorization attempt.
     * @param {import('../../../../../background/auth/authFlowController.js').AuthFailurePayload|null|undefined} failure
     * @returns {'toast'|'fallback'|'scheduled'|'skipped'}
     */
    showFailure(failure) {
      const key = failure?.attemptId || `${failure?.kind}:${Date.now()}`;
      if (notifiedAttempts.has(key)) {
        return 'skipped';
      }
      notifiedAttempts.add(key);
      return presentLatest(buildAuthFailureToast(failure), this.clear());
    },

    /**
     * Confirm a completed authorization once per attempt and drop stale failure feedback.
     * @param {{attemptId?: string}|null|undefined} completion
     * @returns {'toast'|'fallback'|'scheduled'|'skipped'}
     */
    showSuccess(completion) {
      const key = `success:${completion?.attemptId || Date.now()}`;
      if (notifiedAttempts.has(key)) {
        return 'skipped';
      }
      notifiedAttempts.add(key);
      return presentLatest(buildAuthSuccessToast(), this.clear());
    },

    /**
     * Remove feedback shown for earlier attempts.
     * @returns {boolean} True when a native toast had to be closed first.
     */
    clear() {
      let dismissedToast = false;
      if (shownTitles.size > 0) {
        dismissedToast = dismissToasts([...shownTitles]);
      }
      dismissFallback();
      return dismissedToast;
    },
  };
}
