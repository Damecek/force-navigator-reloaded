import { AUTH_FAILURE_KIND } from './authFailure.js';
import { CONNECTED_APP_LABEL, EXTENSION_DISPLAY_NAME } from './constants.js';

/**
 * @typedef {Object} AuthFailureCopy
 * @property {string} title Short headline.
 * @property {string} message Actionable explanation for the current user.
 * @property {string|null} adminSteps What an administrator has to do, when relevant.
 * @property {string|null} originalError Original Salesforce error for diagnosis.
 * @property {boolean} needsAdmin Whether the user cannot fix the failure alone.
 */

/**
 * Build user-facing English copy for an authorization failure.
 * Unconfirmed failures never claim that installation is missing.
 * @param {{kind?: string, confirmed?: boolean, salesforceError?: {error: string, description: string}|null}|null|undefined} failure
 * @param {{appLabel?: string}} [options]
 * @returns {AuthFailureCopy}
 */
export function describeAuthFailure(
  failure,
  { appLabel = CONNECTED_APP_LABEL } = {}
) {
  const originalError = formatOriginalError(failure?.salesforceError);
  const retry = `Then run "Extension > Authorize" from the ${EXTENSION_DISPLAY_NAME} command palette again.`;
  switch (failure?.kind) {
    case AUTH_FAILURE_KIND.APP_NOT_INSTALLED:
      return {
        title: `${EXTENSION_DISPLAY_NAME} needs to be installed in this Salesforce org`,
        message:
          `Your org's policy allows the connected app "${appLabel}" but has not installed it, so Salesforce refuses to authorize the extension. ` +
          `A Salesforce administrator needs to install the connected app in this org. "Allowed" in Connected Apps OAuth Usage does not mean "Installed".`,
        adminSteps:
          `Administrator: open Setup > Connected Apps OAuth Usage, find "${appLabel}", choose Install, and confirm. ` +
          `If the app's policy limits access to assigned users, also assign the user. ${retry}`,
        originalError,
        needsAdmin: true,
      };
    case AUTH_FAILURE_KIND.ACCESS_DENIED:
      return {
        title: 'Authorization was declined',
        message: `Access was denied on the Salesforce consent page, so ${EXTENSION_DISPLAY_NAME} has no access to this org. ${retry.replace('Then run', 'Run')} Choose Allow to enable the commands.`,
        adminSteps: null,
        originalError,
        needsAdmin: false,
      };
    case AUTH_FAILURE_KIND.OAUTH_ERROR:
      return {
        title: 'Salesforce reported an authorization error',
        message: `Salesforce could not complete the authorization of ${EXTENSION_DISPLAY_NAME}. ${retry.replace('Then run', 'Run')} If the error persists, share the Salesforce error below with your administrator.`,
        adminSteps: null,
        originalError,
        needsAdmin: false,
      };
    case AUTH_FAILURE_KIND.CANCELLED:
    case AUTH_FAILURE_KIND.INCOMPLETE:
    default:
      return {
        title: 'Authorization was not completed',
        message: `The authorization window was closed before Salesforce confirmed access. ${retry.replace('Then run', 'Run')} If Salesforce shows an error instead of the consent page, ask your administrator to check whether "${appLabel}" is installed in this org.`,
        adminSteps: null,
        originalError,
        needsAdmin: false,
      };
  }
}

/**
 * Format the original Salesforce OAuth error for diagnostics.
 * @param {{error: string, description: string}|null|undefined} salesforceError
 * @returns {string|null}
 */
export function formatOriginalError(salesforceError) {
  if (!salesforceError?.error) {
    return null;
  }
  return salesforceError.description
    ? `${salesforceError.error}: ${salesforceError.description}`
    : salesforceError.error;
}
