const WORKSPACE_START_URL = '%2FcommunitySetup%2FcwApp.app%23%2Fc%2Fhome';
const DIGITAL_EXPERIENCES_LABEL =
  'Platform Tools > Feature Settings > Digital Experiences';

/**
 * Build Experience Cloud Workspace and Builder navigation commands.
 * @param {Array<{Id: string, Name: string, Status: string}>} networks Network records
 * @param {Array<{Id: string, MasterLabel: string}>} sites Active Site records
 * @returns {Array<{id: string, label: string, path: string, host: 'core'}>}
 */
export function buildExperienceSiteCommands(networks, sites) {
  const sitesByLabel = new Map(sites.map((site) => [site.MasterLabel, site]));
  const commands = [];

  for (const network of networks.filter(
    ({ Name, Status }) => Status !== 'Inactive' && sitesByLabel.has(Name)
  )) {
    const site = sitesByLabel.get(network.Name);
    const networkId = network.Id.slice(0, 15);
    const workspacePath = `/servlet/networks/switch?networkId=${networkId}&startURL=${WORKSPACE_START_URL}&`;
    commands.push({
      id: `experience-site-workspace-${networkId}`,
      label: `${DIGITAL_EXPERIENCES_LABEL} > ${network.Name} > Workspace`,
      path: workspacePath,
      host: 'core',
    });

    const siteId = site.Id.slice(0, 15);
    commands.push({
      id: `experience-site-builder-${siteId}`,
      label: `${DIGITAL_EXPERIENCES_LABEL} > ${network.Name} > Builder`,
      path: `/sfsites/picasso/core/config/commeditor.jsp?exitURL=${encodeURIComponent(workspacePath)}&siteId=${siteId}&`,
      host: 'core',
    });
  }

  return commands;
}
