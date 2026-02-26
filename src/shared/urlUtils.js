import {
  CONTENT_SCRIPT_DISABLED_BASE_DOMAINS,
  CONTENT_SCRIPT_ENABLED_BASE_DOMAINS,
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
  SETUP_SETUP_NODE,
} from './constants.js';

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

  // Guard: If none of the patterns matched, leave host intact but warn
  if (
    !host.endsWith(targetSuffix) &&
    !host.endsWith('.sandbox' + targetSuffix)
  ) {
    console.warn(
      `⚠️ Unknown instance hostname: ${hostname}. Expected to end with ${targetSuffix}`
    );
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
 * Build Salesforce frontdoor URL with destination to Lightning home.
 * @param {string} orgHostname
 * @param {string} sid
 * @param {string} [retURL='/lightning/page/home']
 * @returns {string}
 */
export function buildFrontdoorUrl(
  orgHostname,
  sid,
  retURL = '/lightning/page/home'
) {
  const query = new URLSearchParams({ sid, retURL });
  return `${toCoreUrl(orgHostname)}/secur/frontdoor.jsp?${query.toString()}`;
}

export function buildLightningUrl(fullName, nodeType) {
  const lightningPrefix = '/lightning';
  const slug = fullName.substring(fullName.lastIndexOf('.') + 1);
  switch (nodeType) {
    case SETUP_SETUP_NODE:
      return `${lightningPrefix}/setup/${slug}/home?setupApp=all&SetupDomainProbePassed=true`;
    case PERSONAL_SETTING_SETUP_NODE:
      return `${lightningPrefix}/settings/personal/${slug}/home`;
    case SERVICE_SETUP_SETUP_NODE:
      return `${lightningPrefix}/setup/${slug}/home?setupApp=service&amp;SetupDomainProbePassed=true`;
    default:
      throw new Error(`Unknown node type: ${nodeType}`);
  }
}

/**
 * Checks if the given URL's hostname ends with one of the allowed base domains.
 * @param {string} urlString The URL to check.
 * @returns {boolean} True if the hostname matches an allowed base domain.
 */
export function isContentScriptAllowedDomain(urlString) {
  return isEnabledDomain(
    urlString,
    CONTENT_SCRIPT_ENABLED_BASE_DOMAINS,
    CONTENT_SCRIPT_DISABLED_BASE_DOMAINS
  );
}

function isEnabledDomain(urlString, enabledDomains, disabledDomains) {
  try {
    const hostname = new URL(urlString).hostname;
    return enabledDomains.some(
      (domain) =>
        hostname.endsWith(domain) && !hostname.endsWith(disabledDomains)
    );
  } catch {
    return false;
  }
}
