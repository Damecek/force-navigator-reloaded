import {
  buildLightningUrl,
  CacheManager,
  ENTITY_CACHE_KEY,
  ENTITY_CACHE_TTL,
  FLOW_CACHE_KEY,
  FLOW_CACHE_TTL,
  MENU_CACHE_KEY,
  MENU_CACHE_TTL,
  toLightningHostname,
} from '../shared';
import { staticCommands } from './staticCommands.js';
import { ensureToken } from './auth/auth.js';
import {
  fetchEntityDefinitionsFromSalesforce,
  fetchFlowDefinitionsFromSalesforce,
  fetchMenuNodesFromSalesforce,
} from './salesforceUtils';
import { SalesforceConnection } from './salesforceConnection';

/**
 * Retrieves both static and dynamic commands for a given domain hostname.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @returns {Promise<{NavigationCommand: import('./staticCommands').Command[], RefreshCommandListCommand: import('./staticCommands').Command[]}>} Object containing navigation commands and refresh command list.
 */
export async function getCommands(hostname) {
  const token = await ensureToken(hostname);
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
    ...(await getFlowCommands(instanceHostname, connection)),
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
    console.log('Setup Commands', dedupedCommands.length, dedupedCommands);
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
    console.log('Entity Commands', commands.length, commands);
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

/**
 * Retrieves Flow navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getFlowCommands(hostname, connection) {
  const cache = new CacheManager(hostname);
  const cachedCommands = await cache.get(FLOW_CACHE_KEY);
  if (cachedCommands) {
    return cachedCommands;
  }
  try {
    const flows = await fetchFlowDefinitionsFromSalesforce(connection);
    const commands = [];
    for (const f of flows) {
      const label = f?.LatestVersion?.MasterLabel;
      if (label) {
        commands.push({
          id: `flow-definition-${f.Id}`,
          label: `Flow > Definition > ${label}`,
          path: `/lightning/setup/Flows/page?address=%2F${f.Id}`,
        });
        if (f.LatestVersionId) {
          commands.push({
            id: `flow-latest-${f.Id}`,
            label: `Flow > Latest Version > ${label}`,
            path: `/builder_platform_interaction/flowBuilder.app?flowId=${f.LatestVersionId}`,
          });
        }
        if (f.ActiveVersionId) {
          commands.push({
            id: `flow-active-${f.Id}`,
            label: `Flow > Active Version > ${label}`,
            path: `/builder_platform_interaction/flowBuilder.app?flowId=${f.ActiveVersionId}`,
          });
        }
      }
    }
    console.log('Flow Commands', commands.length, commands);
    if (commands.length > 0) {
      await cache.set(FLOW_CACHE_KEY, commands, FLOW_CACHE_TTL);
    }
    return commands;
  } catch (err) {
    console.error(
      `CommandRegister: failed to fetch flow commands for ${hostname}`,
      err
    );
    return [];
  }
}
