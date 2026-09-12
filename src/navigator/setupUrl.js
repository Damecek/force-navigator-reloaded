import {
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
  SETUP_SETUP_NODE,
} from './constants.js';
/** Build the Lightning route for a Salesforce Setup node. */
export function buildLightningUrl(fullName, nodeType) {
  const lightningPrefix = '/lightning';
  const slug = fullName.substring(fullName.lastIndexOf('.') + 1);
  switch (nodeType) {
    case SETUP_SETUP_NODE:
      return `${lightningPrefix}/setup/${slug}/home?setupApp=all&SetupDomainProbePassed=true`;
    case PERSONAL_SETTING_SETUP_NODE:
      return `${lightningPrefix}/settings/personal/${slug}/home`;
    case SERVICE_SETUP_SETUP_NODE:
      return `${lightningPrefix}/setup/${slug}/home?setupApp=service&SetupDomainProbePassed=true`;
    default:
      throw new Error(`Unknown node type: ${nodeType}`);
  }
}
