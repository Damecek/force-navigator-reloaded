const WORKSPACE_START_URL = '%2FcommunitySetup%2FcwApp.app%23%2Fc%2Fhome';

/**
 * Build Experience Cloud Workspace and Builder navigation commands.
 * @param {Array<{Id: string, Name: string, Status: string}>} networks Network records
 * @param {Array<{Id: string, MasterLabel: string}>} sites Site records
 * @returns {Array<{id: string, label: string, path: string, host: 'core'}>}
 */
export function buildExperienceSiteCommands(networks, sites) {
  const sitesByLabel = new Map(sites.map((site) => [site.MasterLabel, site]));
  const commands = [];

  for (const network of networks) {
    const networkId = network.Id.slice(0, 15);
    const workspacePath = `/servlet/networks/switch?networkId=${networkId}&startURL=${WORKSPACE_START_URL}&`;
    commands.push({
      id: `experience-site-workspace-${networkId}`,
      label: `Experience Cloud > ${network.Name} > Workspace`,
      path: workspacePath,
      host: 'core',
    });

    const site = sitesByLabel.get(network.Name);
    if (site) {
      const siteId = site.Id.slice(0, 15);
      commands.push({
        id: `experience-site-builder-${siteId}`,
        label: `Experience Cloud > ${network.Name} > Builder`,
        path: `/sfsites/picasso/core/config/commeditor.jsp?exitURL=${encodeURIComponent(workspacePath)}&siteId=${siteId}&`,
        host: 'core',
      });
    }
  }

  return commands;
}
