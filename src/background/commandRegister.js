import CacheManager from './cacheManager.js';
import { staticCommands } from './staticCommands.js';
import {
  ENTITY_CACHE_KEY,
  ENTITY_CACHE_TTL,
  MENU_CACHE_KEY,
  MENU_CACHE_TTL,
} from './constants.js';
import { buildLightningUrl, toLightningHostname } from './urlUtils';
import { ensureToken } from './auth/auth.js';
import {
  fetchEntityDefinitionsFromSalesforce,
  fetchMenuNodesFromSalesforce,
} from './salesforceUtils';
import { SalesforceConnection } from './salesforceConnection';

/**
 * Retrieves both static and dynamic commands for a given domain hostname.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @returns {Promise<{NavigationCommand: import('./staticCommands').Command[], RefreshCommandListCommand: import('./staticCommands').Command[]}>} Object containing navigation commands and refresh command list.
 */
export async function getCommands(hostname) {
  let token = await ensureToken(hostname);
  if (!token) {
    return {
      AuthorizeExtensionCommand: [{}],
    };
  }
  const instanceHostname = toLightningHostname(hostname);
  const connection = new SalesforceConnection({
    instanceUrl: token.instance_url,
    accessToken: token.access_token,
  });
  const NavigationCommand = [
    ...staticCommands,
    ...(await getSetupCommands(instanceHostname, connection)),
    ...(await getEntityCommands(instanceHostname, connection)),
  ];
  const RefreshCommandListCommand = [{}];
  return {
    NavigationCommand,
    RefreshCommandListCommand,
  };
}

/**
 * Constructs breadcrumb mappings for menu nodes.
 * @param {Array<{FullName: string, Label: string}>} menuNodes Array of Salesforce setup nodes.
 * @returns {Object<string, string>} Map of FullName to breadcrumb trail.
 * @throws {TypeError} If menuNodes is not an array.
 */
function buildBreadcrumbs(menuNodes) {
  if (!Array.isArray(menuNodes)) {
    throw new TypeError('menuNodes must be an array');
  }

  const labelLookup = Object.create(null);
  for (const { FullName, Label } of menuNodes) {
    labelLookup[FullName] = Label;
  }
  const breadcrumbs = Object.create(null);
  for (const { FullName } of menuNodes) {
    const parts = FullName.split('.');
    const trail = [];

    for (let i = 1; i <= parts.length; i++) {
      const ancestor = parts.slice(0, i).join('.');
      const label = labelLookup[ancestor];
      if (label) {
        trail.push(label);
      } else {
        console.warn(`Missing label for ${ancestor}`);
      }
    }
    breadcrumbs[FullName] = trail.join(' > ');
  }

  return breadcrumbs;
}

/**
 * Retrieves dynamic commands for a given domain via Salesforce API and cache.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param connection {SalesforceConnection} Salesforce connection instance
 * @returns {Promise<import('./staticCommands').Command[]>} Array of dynamic Command instances.
 */
async function getSetupCommands(hostname, connection) {
  const cache = new CacheManager(hostname);
  const cachedCommands = await cache.get(MENU_CACHE_KEY);
  if (cachedCommands) {
    return cachedCommands;
  }
  try {
    const menuNodes = await fetchMenuNodesFromSalesforce(connection);
    const breadcrumbs = buildBreadcrumbs(menuNodes);
    console.log('Breadcrumbs built', breadcrumbs);
    const commands = menuNodes
      .filter((node) => node.Url)
      .map((node) => ({
        id: `${node.NodeType}-${node.FullName}`,
        label: breadcrumbs[node.FullName],
        path: buildLightningUrl(node.FullName, node.NodeType),
      }));
    const dedupedCommands = [
      ...new Map(commands.map((c) => [c.id, c])).values(),
    ];
    console.log('Commands', dedupedCommands);
    if (dedupedCommands.length > 0) {
      await cache.set(MENU_CACHE_KEY, dedupedCommands, MENU_CACHE_TTL);
    }
    return dedupedCommands;
  } catch (err) {
    console.error(
      `CommandRegister: failed to fetch dynamic commands for ${hostname}`,
      err
    );
    return [];
  }
}

/**
 * Retrieves SObject and Custom Metadata navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param connection {SalesforceConnection} Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getEntityCommands(hostname, connection) {
  const cache = new CacheManager(hostname);
  const cachedCommands = await cache.get(ENTITY_CACHE_KEY);
  if (cachedCommands) {
    return cachedCommands;
  }
  try {
    const entities = await fetchEntityDefinitionsFromSalesforce(connection);
    const commands = [];
    for (const e of entities) {
      const { DurableId, KeyPrefix, Label, QualifiedApiName } = e;
      if (QualifiedApiName.endsWith('__mdt')) {
        commands.push({
          id: `custommetadata-new-${KeyPrefix}`,
          label: `Custom Metadata Types > ${Label} > New`,
          path: `/lightning/setup/CustomMetadata/page?address=/${KeyPrefix}/e`,
        });
        commands.push({
          id: `custommetadata-list-${KeyPrefix}`,
          label: `Custom Metadata Types > ${Label} > List`,
          path: `/lightning/setup/CustomMetadata/page?address=/${KeyPrefix}`,
        });
      } else {
        commands.push({
          id: `sobject-setup-detail-${DurableId}`,
          label: `Object Manager > ${Label}`,
          path: `/lightning/setup/ObjectManager/${DurableId}/Details/view`,
        });
        commands.push({
          id: `sobject-new-${QualifiedApiName}`,
          label: `${Label} > New`,
          path: `/lightning/o/${QualifiedApiName}/new`,
        });
        commands.push({
          id: `sobject-list-${QualifiedApiName}`,
          label: `${Label} > List View`,
          path: `/lightning/o/${QualifiedApiName}/list`,
        });
      }
    }
    console.log('Commands', commands);
    if (commands.length > 0) {
      await cache.set(ENTITY_CACHE_KEY, commands, ENTITY_CACHE_TTL);
    }
    return commands;
  } catch (err) {
    console.error(
      `CommandRegister: failed to fetch entity commands for ${hostname}`,
      err
    );
    return [];
  }
}
