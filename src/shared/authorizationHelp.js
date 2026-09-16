import { CONNECTED_APP_LABEL, EXTENSION_DISPLAY_NAME } from './constants.js';

/**
 * Steps a Salesforce administrator follows to install the connected app.
 * @param {string} appLabel
 * @returns {string[]}
 */
export function buildAdminInstallSteps(appLabel = CONNECTED_APP_LABEL) {
  return [
    'In Salesforce, open Setup and enter "Connected Apps OAuth Usage" in Quick Find.',
    `Find "${appLabel}" in the list. "Allowed" only means the app may request access; it is not installed yet.`,
    `Click Install next to "${appLabel}" and confirm the installation.`,
    'If your org limits the app to admin-approved users, open the installed app, set Permitted Users to "Admin approved users are pre-authorized", and assign the user\'s profile or a permission set.',
    `Ask the user to run "Extension > Authorize" from the ${EXTENSION_DISPLAY_NAME} command palette again and choose Allow.`,
  ];
}

/**
 * Plain-text instructions that a user can paste into a message to an administrator.
 * @param {Object} [options]
 * @param {string} [options.appLabel]
 * @param {string} [options.orgHostname] My Domain hostname of the org, when known.
 * @returns {string}
 */
export function buildAdminInstructions({
  appLabel = CONNECTED_APP_LABEL,
  orgHostname,
} = {}) {
  const where = orgHostname ? ` in ${orgHostname}` : ' in our Salesforce org';
  const steps = buildAdminInstallSteps(appLabel)
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
  return [
    `Hi, I use the ${EXTENSION_DISPLAY_NAME} Chrome extension and Salesforce refuses to authorize it${where}.`,
    `Salesforce reports "invalid_client: app must be installed into org". The connected app "${appLabel}" is allowed but not installed, and only an administrator can install it.`,
    '',
    steps,
    '',
    'Installing the connected app does not deploy anything to the org and does not change existing integrations. Thank you!',
  ].join('\n');
}
