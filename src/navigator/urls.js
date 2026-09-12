/**
 * Prepare the list of [RegExp, replacement] pairs for a given target suffix.
 * @param {string} targetSuffix - e.g. '.lightning.force.com' or '.my.salesforce.com'
 * @returns {[RegExp,string][]}
 */
const buildPatterns = (targetSuffix) => [
  // sandbox Lightning / core / Sites
  [/\.sandbox\.lightning\.force\.com$/, '.sandbox' + targetSuffix],
  [/\.sandbox\.my\.salesforce\.com$/, '.sandbox' + targetSuffix],
  [/\.sandbox\.my\.site\.com$/, '.sandbox' + targetSuffix],

  // canvas VF & derivatives
  [
    /--c(\.[^.]+)?\.vf\.force\.com$/,
    (_, env) => {
      return (env || '') + targetSuffix;
    },
  ],

  // Experience Builder / Sites / Setup
  [/\.builder\.salesforce-experience\.com$/, targetSuffix],
  [/\.my\.salesforce-sites\.com$/, targetSuffix],
  [/\.my\.salesforce-setup\.com$/, targetSuffix],
  [/\.salesforce-setup\.com$/, targetSuffix],

  // Visualforce (prod & legacy)
  [/\.vf\.force\.com$/, targetSuffix],
  [/\.visual\.force\.com$/, targetSuffix],

  // Lightning (prod)
  [/\.lightning\.force\.com$/, targetSuffix],

  // Core My Domain (prod)
  [/\.my\.salesforce\.com$/, targetSuffix],

  // Legacy core without 'my'
  [/\.salesforce\.com$/, targetSuffix],

  // File domains (login)
  [/\.file\.force\.com$/, targetSuffix],

  // Experience Cloud (prod)
  [/\.my\.site\.com$/, targetSuffix],
];

/**
 * Internal generic mapper, parametric in the target suffix.
 * @param {string} urlOrHost - full URL or hostname
 * @param {string} targetSuffix - e.g. '.lightning.force.com'
 * @returns {string} hostname ending with given targetSuffix
 */
function mapInstanceHostname(urlOrHost, targetSuffix) {
  const { hostname } = urlOrHost.includes('://')
    ? new URL(urlOrHost)
    : new URL('https://' + urlOrHost);
  let host = hostname.toLowerCase();

  for (const [rx, repl] of buildPatterns(targetSuffix)) {
    if (rx.test(host)) {
      host = host.replace(rx, repl);
      break;
    }
  }

  return host;
}

/**
 * Convert a given Salesforce URL/host to its Lightning hostname
 * (… .lightning.force.com or … .sandbox.lightning.force.com).
 */
export const toLightningHostname = (urlOrHost) =>
  mapInstanceHostname(urlOrHost, '.lightning.force.com');

export const toLightningUrl = (urlOrHost) =>
  `https://${toLightningHostname(urlOrHost)}`;

/**
 * Convert a given Salesforce URL/host to its Core My Domain hostname
 * (… .my.salesforce.com or … .sandbox.my.salesforce.com).
 */
export const toCoreHostname = (urlOrHost) =>
  mapInstanceHostname(urlOrHost, '.my.salesforce.com');

export const toCoreUrl = (urlOrHost) => `https://${toCoreHostname(urlOrHost)}`;

/**
 * Convert a Salesforce URL or hostname to its Setup URL.
 * @param {string} urlOrHost Salesforce URL or hostname
 * @returns {string} Setup URL preserving the org and sandbox
 */
export const toSetupUrl = (urlOrHost) =>
  `https://${mapInstanceHostname(urlOrHost, '.my.salesforce-setup.com')}`;
