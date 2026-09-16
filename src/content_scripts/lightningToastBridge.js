import { injectPageScript } from './pageScriptInjector.js';

const SHOW_EVENT = 'forceNavigatorShowToast';
const DISMISS_EVENT = 'forceNavigatorDismissToasts';
export const OPEN_AUTH_HELP_EVENT = 'forceNavigatorOpenAuthHelp';

/**
 * @typedef {Object} ToastRequest
 * @property {string} title
 * @property {string} message
 * @property {'error'|'success'|'info'|'warning'} [variant]
 * @property {'sticky'|'dismissible'|'pester'} [mode]
 * @property {number} [duration] Milliseconds for non-sticky toasts.
 * @property {string} [helpLabel] Label of an optional help link appended to the message.
 * @property {string} [helpUrl] Public URL of the help link.
 */

/**
 * Inject the page-context toast handler.
 * @returns {void}
 */
export function injectLightningToastBridge() {
  injectPageScript('lightningToast.js', 'force-navigator-toast');
}

/**
 * Ask the host page to show a native Salesforce toast.
 * @param {ToastRequest} request
 * @returns {boolean} True when the host displayed the toast.
 */
export function showLightningToast(request) {
  if (!request?.title) {
    return false;
  }
  const event = new CustomEvent(SHOW_EVENT, {
    detail: request,
    cancelable: true,
  });
  return !document.dispatchEvent(event);
}

/**
 * Close native toasts previously shown through the bridge.
 * @param {string[]} [titles] Titles to close; all bridge toasts when omitted.
 * @returns {boolean} True when at least one toast was closed.
 */
export function dismissLightningToasts(titles) {
  const event = new CustomEvent(DISMISS_EVENT, {
    detail: { titles },
    cancelable: true,
  });
  return !document.dispatchEvent(event);
}
